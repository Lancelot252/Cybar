document.addEventListener('DOMContentLoaded', () => {
    const section = document.getElementById('home-recommendations-section');
    const list = document.getElementById('home-recommendations-list');
    const status = document.getElementById('home-recommendations-status');
    const refreshButton = document.getElementById('refresh-home-recommendations');
    const DEFAULT_IMAGE = '/uploads/cocktails/jiu.jpg';

    if (!section || !list || !status) {
        return;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function metricIcon(type) {
        if (type === 'likes') {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 20H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h4v10z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 10l2.6-5.1A1.8 1.8 0 0 1 16 6.4V10h2.2a1.8 1.8 0 0 1 1.7 2.3l-1.6 5.5A2.4 2.4 0 0 1 16 19.5H10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
        }

        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12a2 2 0 0 1 2 2v14l-8-4-8 4V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    }

    function renderStatus(text, variant = 'loading') {
        status.hidden = false;
        status.className = `state-${variant}`;
        status.textContent = text;
    }

    function renderCards(items) {
        list.innerHTML = '';

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const card = document.createElement('article');
            card.className = 'home-recommendation-card';

            const imageSrc = item.image || DEFAULT_IMAGE;
            const abvValue = Number(item.estimatedAbv);
            const abvText = Number.isFinite(abvValue) ? `${abvValue.toFixed(1)}% ABV` : 'ABV 未知';
            const reasonText = item.reason || '综合推荐';
            const creator = item.createdBy || '未知用户';
            const likeCount = Number(item.likeCount) || 0;
            const favoriteCount = Number(item.favoriteCount) || 0;

            card.innerHTML = `
                <a class="recommendation-cover" href="/recipes/detail.html?id=${encodeURIComponent(item.id)}" aria-label="查看 ${escapeHtml(item.name)} 详情">
                    <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(item.name)} 封面" loading="lazy">
                </a>
                <div class="recommendation-body">
                    <h3><a href="/recipes/detail.html?id=${encodeURIComponent(item.id)}">${escapeHtml(item.name)}</a></h3>
                    <p class="recommendation-meta">
                        <span>${escapeHtml(abvText)}</span>
                        <span>创作者：${escapeHtml(creator)}</span>
                    </p>
                    <p class="recommendation-reason">${escapeHtml(reasonText)}</p>
                    <div class="recommendation-metrics">
                        <span class="metric-item">${metricIcon('likes')}<strong>${likeCount}</strong></span>
                        <span class="metric-item">${metricIcon('favorites')}<strong>${favoriteCount}</strong></span>
                    </div>
                </div>
            `;

            const image = card.querySelector('img');
            if (image) {
                image.addEventListener('error', () => {
                    if (image.dataset.fallbackApplied === '1') return;
                    image.dataset.fallbackApplied = '1';
                    image.src = DEFAULT_IMAGE;
                });
            }

            fragment.appendChild(card);
        });

        list.appendChild(fragment);
        list.hidden = false;
        status.hidden = true;
    }

    async function loadRecommendations() {
        renderStatus('正在加载推荐...', 'loading');
        list.hidden = true;

        try {
            const response = await fetch('/api/recommendations?limit=8', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];

            if (recommendations.length === 0) {
                renderStatus('暂时没有可推荐的配方。', 'empty');
                return;
            }

            renderCards(recommendations);
        } catch (error) {
            console.error('加载首页推荐失败:', error);
            renderStatus('推荐加载失败，请稍后重试。', 'error');
        }
    }

    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            loadRecommendations();
        });
    }

    loadRecommendations();
});
