document.addEventListener('DOMContentLoaded', () => {
    const errorMessageElement = document.getElementById('error-message');
    const urlParams = new URLSearchParams(window.location.search);
    const recipeId = urlParams.get('id');

    if (!recipeId) {
        setMessage(errorMessageElement, '错误：未在 URL 中指定配方 ID。');
        return;
    }

    fetch(`/api/recipes/${recipeId}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then((recipe) => {
            displayRecipeDetail(recipe);
            loadInteractionData(recipeId);
            if (window.startAITasteAnalysis) {
                window.startAITasteAnalysis(recipe);
            }
        })
        .catch((error) => {
            console.error('获取配方详情时出错:', error.message);
            const text = error.message.includes('404') ? '未找到配方' : '服务器错误或网络问题';
            setMessage(errorMessageElement, `获取配方详情时出错: ${text}`);
        });

    loadComments(recipeId);
    setupCommentForm(recipeId);

    const commentsListContainer = document.getElementById('comments-list');
    if (commentsListContainer) {
        commentsListContainer.addEventListener('click', (event) => {
            if (!event.target.classList.contains('delete-comment-btn')) return;
            const commentId = event.target.dataset.commentId;
            if (commentId && confirm('确定要删除这条评论吗？')) {
                deleteComment(commentId, event.target);
            }
        });
    }
});

function setMessage(messageEl, text) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.hidden = !text;
}

function showElement(el) {
    if (el) el.hidden = false;
}

function hideElement(el) {
    if (el) el.hidden = true;
}

function displayRecipeDetail(recipe) {
    const container = document.getElementById('recipe-detail');
    if (!container) return;

    container.innerHTML = '';

    const contentContainer = document.createElement('div');
    contentContainer.className = 'recipe-content';

    const title = document.createElement('h2');
    title.textContent = recipe.name || '未命名配方';
    contentContainer.appendChild(title);

    if (recipe.description) {
        const summary = document.createElement('p');
        summary.className = 'recipe-summary';
        summary.textContent = recipe.description;
        contentContainer.appendChild(summary);
    }

    const imageWrap = document.createElement('figure');
    imageWrap.className = 'recipe-image-wrap';
    const image = document.createElement('img');
    image.className = 'recipe-main-image';
    image.src = recipe.image || '/uploads/cocktails/jiu.jpg';
    image.alt = recipe.name || '配方成品图';
    image.addEventListener('click', () => {
        window.open(image.src, '_blank', 'noopener');
    });
    imageWrap.appendChild(image);
    contentContainer.appendChild(imageWrap);

    const socialBar = document.createElement('div');
    socialBar.className = 'social-interaction-bar';
    socialBar.innerHTML = `
        <div class="interaction-wrapper">
            <button id="like-button" class="interaction-btn" type="button">
                <i class="far fa-heart"></i>
                <span id="like-count">${recipe.likeCount ?? 0}</span>
            </button>
        </div>
        <div class="interaction-wrapper">
            <button id="favorite-button" class="interaction-btn" type="button">
                <i class="far fa-bookmark"></i>
                <span id="favorite-count">${recipe.favoriteCount ?? 0}</span>
            </button>
        </div>
    `;
    contentContainer.appendChild(socialBar);

    const creatorInfo = document.createElement('p');
    creatorInfo.className = 'recipe-creator-detail';
    creatorInfo.innerHTML = `
        <img class="creator-avatar" src="${recipe.creatorAvatar || '/uploads/avatars/default-avatar.png'}" alt="头像">
        <span><strong>创建者:</strong> ${recipe.createdBy || '未知用户'}</span>
    `;
    contentContainer.appendChild(creatorInfo);

    if (recipe.description) {
        const descElement = document.createElement('p');
        descElement.className = 'recipe-description';
        descElement.innerHTML = `<strong>描述:</strong> ${escapeHTML(recipe.description)}`;
        contentContainer.appendChild(descElement);
    }

    const ingredientsTitle = document.createElement('h3');
    ingredientsTitle.className = 'recipe-section-title';
    ingredientsTitle.textContent = '配料';
    contentContainer.appendChild(ingredientsTitle);

    const ingredientsList = document.createElement('ul');
    ingredientsList.className = 'recipe-ingredients-list';
    if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) {
        recipe.ingredients.forEach((ing) => {
            const li = document.createElement('li');
            li.textContent = `${ing.name}: ${ing.volume}ml (ABV: ${ing.abv}%)`;
            ingredientsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = '暂无配料信息';
        ingredientsList.appendChild(li);
    }
    contentContainer.appendChild(ingredientsList);

    const instructionsTitle = document.createElement('h3');
    instructionsTitle.className = 'recipe-section-title';
    instructionsTitle.textContent = '制作方法';
    contentContainer.appendChild(instructionsTitle);

    const instructions = document.createElement('p');
    instructions.className = 'recipe-instructions';
    instructions.textContent = recipe.instructions || '暂无制作方法';
    contentContainer.appendChild(instructions);

    const abv = document.createElement('p');
    abv.className = 'recipe-meta-block';
    abv.innerHTML = `<strong>预计酒精度:</strong> ${recipe.estimatedAbv ?? 'N/A'}%`;
    contentContainer.appendChild(abv);

    container.appendChild(contentContainer);
    setupInteractionListeners(recipe.id);
}

function setupInteractionListeners(recipeId) {
    const likeButton = document.getElementById('like-button');
    const favoriteButton = document.getElementById('favorite-button');

    if (likeButton) {
        likeButton.addEventListener('click', async () => {
            if (!document.body.classList.contains('logged-in')) {
                alert('请登录后再点赞');
                return;
            }
            try {
                const response = await fetch(`/api/recipes/${recipeId}/like`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!response.ok) throw new Error('Failed');
                const data = await response.json();
                updateInteractionUI(data);
            } catch (error) {
                console.error('Error toggling like:', error);
            }
        });
    }

    if (favoriteButton) {
        favoriteButton.addEventListener('click', async () => {
            if (!document.body.classList.contains('logged-in')) {
                alert('请登录后再收藏');
                return;
            }
            try {
                const response = await fetch(`/api/recipes/${recipeId}/favorite`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!response.ok) throw new Error('Failed');
                const data = await response.json();
                updateInteractionUI(data);
            } catch (error) {
                console.error('Error toggling favorite:', error);
            }
        });
    }
}

function updateInteractionUI(data) {
    const likeButton = document.getElementById('like-button');
    const favoriteButton = document.getElementById('favorite-button');
    const likeCountSpan = document.getElementById('like-count');
    const favoriteCountSpan = document.getElementById('favorite-count');

    if (!likeButton || !favoriteButton) return;

    if (typeof data.likeCount !== 'undefined' && likeCountSpan) {
        likeCountSpan.textContent = data.likeCount;
    }
    if (typeof data.favoriteCount !== 'undefined' && favoriteCountSpan) {
        favoriteCountSpan.textContent = data.favoriteCount;
    }

    if (typeof data.isLiked !== 'undefined') {
        likeButton.classList.toggle('is-liked', Boolean(data.isLiked));
        const icon = likeButton.querySelector('i');
        if (icon) {
            icon.className = data.isLiked ? 'fas fa-heart' : 'far fa-heart';
        }
    }

    if (typeof data.isFavorited !== 'undefined') {
        favoriteButton.classList.toggle('is-favorited', Boolean(data.isFavorited));
        const icon = favoriteButton.querySelector('i');
        if (icon) {
            icon.className = data.isFavorited ? 'fas fa-bookmark' : 'far fa-bookmark';
        }
    }
}

async function loadComments(recipeId) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;
    commentsListContainer.innerHTML = '<p>正在加载评论...</p>';

    try {
        const response = await fetch(`/api/recipes/${recipeId}/comments`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const comments = await response.json();
        renderComments(comments);
    } catch (error) {
        console.error('获取评论出错:', error);
        commentsListContainer.innerHTML = '<p class="state-error">无法加载评论。</p>';
    }
}

function renderComments(comments) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;
    commentsListContainer.innerHTML = '';

    if (!comments || comments.length === 0) {
        commentsListContainer.innerHTML = '<p class="state-empty">暂无评论。</p>';
        return;
    }

    const isAdmin = document.body.classList.contains('is-admin');
    comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    comments.forEach((comment) => {
        const commentDiv = document.createElement('div');
        commentDiv.classList.add('comment');
        commentDiv.dataset.commentId = comment.id;

        const deleteButtonHTML = isAdmin
            ? `<button class="delete-comment-btn" data-comment-id="${comment.id}" title="删除评论">×</button>`
            : '';

        commentDiv.innerHTML = `
            <div class="comment-header">
                <p class="comment-meta">
                    <strong>${comment.username || '匿名用户'}</strong>
                    <span> - ${new Date(comment.timestamp).toLocaleString('zh-CN')}</span>
                </p>
                ${deleteButtonHTML}
            </div>
            <p class="comment-text">${escapeHTML(comment.text)}</p>
        `;
        commentsListContainer.appendChild(commentDiv);
    });
}

function setupCommentForm(recipeId) {
    const commentForm = document.getElementById('comment-form');
    const commentText = document.getElementById('comment-text');
    const commentError = document.getElementById('comment-error');
    const loginPrompt = document.getElementById('login-prompt');

    const syncAuthVisibility = () => {
        if (document.body.classList.contains('logged-out')) {
            hideElement(commentForm);
            showElement(loginPrompt);
            return false;
        }
        showElement(commentForm);
        hideElement(loginPrompt);
        return true;
    };

    if (!syncAuthVisibility()) {
        document.addEventListener('authStatusKnown', () => {
            syncAuthVisibility();
        }, { once: true });
        return;
    }

    if (!commentForm || !commentText) return;

    commentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage(commentError, '');

        const commentContent = commentText.value.trim();
        if (!commentContent) {
            setMessage(commentError, '评论内容不能为空。');
            return;
        }

        try {
            const response = await fetch(`/api/recipes/${recipeId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentText: commentContent })
            });

            if (response.ok) {
                const newComment = await response.json();
                commentText.value = '';
                addCommentToDOM(newComment);
                return;
            }

            let errorData = { message: '提交失败' };
            try {
                errorData = await response.json();
            } catch (jsonErr) {
                // ignore
            }
            setMessage(commentError, errorData.message);
        } catch (error) {
            console.error('提交评论出错:', error);
            setMessage(commentError, '提交评论失败，请稍后重试。');
        }
    });

    document.addEventListener('authStatusKnown', () => {
        syncAuthVisibility();
    });
}

function addCommentToDOM(comment) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;

    const placeholder = commentsListContainer.querySelector('.state-empty');
    if (placeholder) {
        commentsListContainer.innerHTML = '';
    }

    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment');
    commentDiv.innerHTML = `
        <div class="comment-header">
            <p class="comment-meta">
                <strong>${comment.username || '匿名用户'}</strong>
                <span> - ${new Date(comment.timestamp).toLocaleString('zh-CN')}</span>
            </p>
        </div>
        <p class="comment-text">${escapeHTML(comment.text)}</p>
    `;
    commentsListContainer.insertBefore(commentDiv, commentsListContainer.firstChild);
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str || '')));
    return div.innerHTML;
}

async function deleteComment(commentId, buttonElement) {
    buttonElement.disabled = true;
    buttonElement.textContent = '...';

    try {
        const response = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
        if (response.ok) {
            const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
            if (commentElement) commentElement.remove();

            const commentsListContainer = document.getElementById('comments-list');
            if (commentsListContainer && !commentsListContainer.querySelector('.comment')) {
                commentsListContainer.innerHTML = '<p class="state-empty">暂无评论。</p>';
            }
            alert('评论删除成功！');
            return;
        }

        alert('删除失败');
        buttonElement.disabled = false;
        buttonElement.textContent = '×';
    } catch (error) {
        console.error('Error:', error);
        alert('网络错误');
        buttonElement.disabled = false;
        buttonElement.textContent = '×';
    }
}

async function loadInteractionData(recipeId) {
    try {
        const response = await fetch(`/api/recipes/${recipeId}/interactions`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();

        updateInteractionUI(data);

        if (!document.body.classList.contains('logged-in')) {
            const likeButton = document.getElementById('like-button');
            const favoriteButton = document.getElementById('favorite-button');
            if (likeButton) likeButton.disabled = true;
            if (favoriteButton) favoriteButton.disabled = true;
        }
    } catch (error) {
        console.error('Error loading interaction data:', error);
    }
}

async function startAITasteAnalysis(recipe) {
    window.currentRecipe = recipe;

    const analysisSection = document.getElementById('ai-taste-analysis');
    const loadingElement = document.getElementById('ai-analysis-loading');
    const resultsElement = document.getElementById('ai-analysis-results');
    const errorElement = document.getElementById('ai-analysis-error');
    const metaElement = document.getElementById('ai-analysis-meta');

    showElement(analysisSection);
    showElement(loadingElement);
    hideElement(resultsElement);
    hideElement(errorElement);
    hideElement(metaElement);

    try {
        const analysisData = {
            name: recipe.name,
            description: `由 ${recipe.createdBy} 创建的鸡尾酒配方`,
            ingredients: recipe.ingredients || [],
            steps: recipe.instructions ? [recipe.instructions] : []
        };

        const response = await fetch('/api/custom/analyze-flavor', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(analysisData)
        });

        const result = await response.json();
        hideElement(loadingElement);

        if (response.ok && result.success) {
            displayAIAnalysisResult(result.analysis, result.analyzedAt);
            return;
        }

        showAIAnalysisError(result.message || 'AI分析失败，请稍后重试');
    } catch (error) {
        console.error('AI口味分析请求失败:', error);
        hideElement(loadingElement);
        showAIAnalysisError('网络连接异常，AI分析暂时不可用');
    }
}

function displayAIAnalysisResult(analysis, analyzedAt) {
    const contentElement = document.getElementById('ai-analysis-content');
    const metaElement = document.getElementById('ai-analysis-meta');
    const resultsElement = document.getElementById('ai-analysis-results');

    contentElement.innerHTML = formatAnalysisText(analysis);

    if (analyzedAt) {
        const analysisTime = new Date(analyzedAt).toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        metaElement.innerHTML = `<i class="fas fa-clock"></i> 分析时间: ${analysisTime}`;
        showElement(metaElement);
    }

    const tasteData = extractTasteDataFromAnalysis(analysis) || generateDefaultTasteData(window.currentRecipe || {});
    displayTasteVisualization(tasteData);
    showElement(resultsElement);
}

function extractTasteDataFromAnalysis(analysis) {
    try {
        const standardPatterns = {
            sweetness: /甜度[：:\s]*([0-5])(?:[\/\s]*5)?/gi,
            sourness: /酸度[：:\s]*([0-5])(?:[\/\s]*5)?/gi,
            bitterness: /苦度[：:\s]*([0-5])(?:[\/\s]*5)?/gi,
            strength: /烈度[：:\s]*([0-5])(?:[\/\s]*5)?/gi,
            freshness: /清爽度[：:\s]*([0-5])(?:[\/\s]*5)?/gi
        };

        const fallbackPatterns = {
            sweetness: /甜味[：:\s]*([0-5])|偏?甜[：:\s]*([0-5])|糖分[：:\s]*([0-5])/gi,
            sourness: /酸味[：:\s]*([0-5])|偏?酸[：:\s]*([0-5])|酸爽[：:\s]*([0-5])/gi,
            bitterness: /苦味[：:\s]*([0-5])|偏?苦[：:\s]*([0-5])|苦涩[：:\s]*([0-5])/gi,
            strength: /酒精感[：:\s]*([0-5])|烈性[：:\s]*([0-5])|酒精度感受[：:\s]*([0-5])|强度[：:\s]*([0-5])/gi,
            freshness: /清新[：:\s]*([0-5])|爽口[：:\s]*([0-5])|清香[：:\s]*([0-5])/gi
        };

        const descriptiveMapping = {
            sweetness: { '极甜': 5, '很甜': 4, '较甜': 3, '微甜': 2, '不甜': 1, '无甜味': 0, '甜腻': 5, '甜美': 4, '香甜': 3, '淡甜': 2 },
            sourness: { '极酸': 5, '很酸': 4, '较酸': 3, '微酸': 2, '不酸': 1, '无酸味': 0, '酸爽': 4, '清酸': 3, '淡酸': 2 },
            bitterness: { '极苦': 5, '很苦': 4, '较苦': 3, '微苦': 2, '不苦': 1, '无苦味': 0, '苦涩': 4, '略苦': 2 },
            strength: { '极烈': 5, '很烈': 4, '较烈': 3, '微烈': 2, '不烈': 1, '温和': 1, '强烈': 4, '适中': 3, '轻度': 2, '柔和': 1 },
            freshness: { '极清爽': 5, '很清爽': 4, '较清爽': 3, '微清爽': 2, '不清爽': 1, '清新': 4, '爽口': 4, '清香': 3, '淡雅': 2 }
        };

        const tasteData = {
            sweetness: null,
            sourness: null,
            bitterness: null,
            strength: null,
            freshness: null
        };

        for (const [dimension, pattern] of Object.entries(standardPatterns)) {
            let match;
            while ((match = pattern.exec(analysis)) !== null) {
                for (let i = 1; i < match.length; i += 1) {
                    if (match[i] === undefined) continue;
                    const value = Number.parseInt(match[i], 10);
                    if (!Number.isNaN(value) && value >= 0 && value <= 5) {
                        tasteData[dimension] = value;
                        break;
                    }
                }
                if (tasteData[dimension] !== null) break;
            }
        }

        for (const [dimension, pattern] of Object.entries(fallbackPatterns)) {
            if (tasteData[dimension] !== null) continue;
            let match;
            while ((match = pattern.exec(analysis)) !== null) {
                for (let i = 1; i < match.length; i += 1) {
                    if (match[i] === undefined) continue;
                    const value = Number.parseInt(match[i], 10);
                    if (!Number.isNaN(value) && value >= 0 && value <= 5) {
                        tasteData[dimension] = value;
                        break;
                    }
                }
                if (tasteData[dimension] !== null) break;
            }
        }

        for (const [dimension, mapping] of Object.entries(descriptiveMapping)) {
            if (tasteData[dimension] !== null) continue;
            for (const [desc, value] of Object.entries(mapping)) {
                if (analysis.includes(desc)) {
                    tasteData[dimension] = value;
                    break;
                }
            }
        }

        const validValues = Object.values(tasteData).filter((v) => v !== null);
        if (!validValues.length) return null;

        return {
            sweetness: tasteData.sweetness ?? 2,
            sourness: tasteData.sourness ?? 2,
            bitterness: tasteData.bitterness ?? 2,
            strength: tasteData.strength ?? 3,
            freshness: tasteData.freshness ?? 3
        };
    } catch (error) {
        console.warn('无法从AI分析中提取口味数据:', error);
        return null;
    }
}

function generateDefaultTasteData(recipe) {
    let sweetness = 0;
    let sourness = 0;
    let bitterness = 0;
    let strength = 0;
    let freshness = 0;
    let totalVolume = 0;
    let alcoholContent = 0;

    const ingredientProfiles = {
        '伏特加': { sweetness: 0, sourness: 0, bitterness: 0, strength: 4, freshness: 2 },
        '金酒': { sweetness: 0, sourness: 0, bitterness: 1, strength: 4, freshness: 3 },
        '威士忌': { sweetness: 1, sourness: 0, bitterness: 2, strength: 5, freshness: 1 },
        '白兰地': { sweetness: 2, sourness: 0, bitterness: 1, strength: 4, freshness: 1 },
        '朗姆酒': { sweetness: 3, sourness: 0, bitterness: 0, strength: 4, freshness: 2 },
        '龙舌兰': { sweetness: 1, sourness: 0, bitterness: 1, strength: 4, freshness: 2 },
        '君度': { sweetness: 4, sourness: 1, bitterness: 0, strength: 3, freshness: 3 },
        '橙皮酒': { sweetness: 4, sourness: 2, bitterness: 1, strength: 3, freshness: 3 },
        '咖啡利口酒': { sweetness: 4, sourness: 0, bitterness: 3, strength: 2, freshness: 0 },
        '薄荷利口酒': { sweetness: 3, sourness: 0, bitterness: 0, strength: 2, freshness: 5 },
        '柠檬汁': { sweetness: 1, sourness: 5, bitterness: 0, strength: 0, freshness: 4 },
        '青柠汁': { sweetness: 0, sourness: 5, bitterness: 1, strength: 0, freshness: 5 },
        '橙汁': { sweetness: 4, sourness: 2, bitterness: 0, strength: 0, freshness: 3 },
        '蔓越莓汁': { sweetness: 3, sourness: 3, bitterness: 1, strength: 0, freshness: 3 },
        '菠萝汁': { sweetness: 5, sourness: 1, bitterness: 0, strength: 0, freshness: 3 },
        '番茄汁': { sweetness: 2, sourness: 2, bitterness: 0, strength: 0, freshness: 2 },
        '简单糖浆': { sweetness: 5, sourness: 0, bitterness: 0, strength: 0, freshness: 0 },
        '蜂蜜糖浆': { sweetness: 5, sourness: 0, bitterness: 0, strength: 0, freshness: 1 },
        '薄荷糖浆': { sweetness: 4, sourness: 0, bitterness: 0, strength: 0, freshness: 5 },
        '香草糖浆': { sweetness: 5, sourness: 0, bitterness: 0, strength: 0, freshness: 1 },
        '苏打水': { sweetness: 0, sourness: 0, bitterness: 0, strength: 0, freshness: 5 },
        '汤力水': { sweetness: 2, sourness: 0, bitterness: 2, strength: 0, freshness: 4 },
        '姜汁汽水': { sweetness: 3, sourness: 0, bitterness: 1, strength: 0, freshness: 4 },
        '可乐': { sweetness: 4, sourness: 0, bitterness: 0, strength: 0, freshness: 2 },
        '安格斯图拉苦精': { sweetness: 0, sourness: 0, bitterness: 5, strength: 1, freshness: 0 },
        '橙子苦精': { sweetness: 1, sourness: 1, bitterness: 4, strength: 1, freshness: 2 },
        '柠檬皮': { sweetness: 0, sourness: 2, bitterness: 1, strength: 0, freshness: 4 },
        '橙皮': { sweetness: 1, sourness: 1, bitterness: 1, strength: 0, freshness: 3 },
        '薄荷叶': { sweetness: 0, sourness: 0, bitterness: 0, strength: 0, freshness: 5 },
        '盐': { sweetness: 0, sourness: 0, bitterness: 0, strength: 0, freshness: 1 },
        '黑胡椒': { sweetness: 0, sourness: 0, bitterness: 2, strength: 0, freshness: 0 }
    };

    if (Array.isArray(recipe.ingredients)) {
        recipe.ingredients.forEach((ing) => {
            const name = String(ing.name || '');
            const volume = Number.parseFloat(ing.volume) || 0;
            const ingredientAbv = Number.parseFloat(ing.abv) || 0;

            totalVolume += volume;
            alcoholContent += volume * (ingredientAbv / 100);

            let profile = ingredientProfiles[name];
            if (!profile) {
                const lowerName = name.toLowerCase();
                Object.entries(ingredientProfiles).some(([key, value]) => {
                    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
                        profile = value;
                        return true;
                    }
                    return false;
                });
            }

            if (!profile) {
                profile = { sweetness: 1, sourness: 1, bitterness: 1, strength: 1, freshness: 1 };
                const lowerName = name.toLowerCase();
                if (lowerName.includes('糖') || lowerName.includes('蜜') || lowerName.includes('甜')) profile.sweetness = 4;
                if (lowerName.includes('柠檬') || lowerName.includes('酸') || lowerName.includes('醋')) profile.sourness = 4;
                if (lowerName.includes('苦') || lowerName.includes('咖啡') || lowerName.includes('茶')) profile.bitterness = 3;
                if (ingredientAbv > 20) profile.strength = Math.min(5, Math.floor(ingredientAbv / 10));
                if (lowerName.includes('薄荷') || lowerName.includes('苏打') || lowerName.includes('汽水')) profile.freshness = 4;
            }

            const weight = volume / Math.max(totalVolume, 1);
            sweetness += profile.sweetness * weight;
            sourness += profile.sourness * weight;
            bitterness += profile.bitterness * weight;
            strength += profile.strength * weight;
            freshness += profile.freshness * weight;
        });

        if (totalVolume > 0) {
            const finalAbv = (alcoholContent / totalVolume) * 100;
            strength = Math.max(strength, finalAbv / 10);
        }

        if (recipe.estimatedAbv && !Number.isNaN(Number.parseFloat(recipe.estimatedAbv))) {
            strength = Math.max(strength, Number.parseFloat(recipe.estimatedAbv) / 10);
        }
    }

    return {
        sweetness: Math.min(5, Math.max(0, Math.round(sweetness * 10) / 10)),
        sourness: Math.min(5, Math.max(0, Math.round(sourness * 10) / 10)),
        bitterness: Math.min(5, Math.max(0, Math.round(bitterness * 10) / 10)),
        strength: Math.min(5, Math.max(0, Math.round(strength * 10) / 10)),
        freshness: Math.min(5, Math.max(0, Math.round(freshness * 10) / 10))
    };
}

function displayTasteVisualization(tasteData) {
    updateTasteBars(tasteData);
    updateRadarChart(tasteData);
}

function updateTasteBars(tasteData) {
    const tasteDimensions = ['sweetness', 'sourness', 'bitterness', 'strength', 'freshness'];

    tasteDimensions.forEach((dimension, index) => {
        const value = tasteData[dimension] || 0;
        const percentage = (value / 5) * 100;

        const valueElement = document.getElementById(`${dimension}-value`);
        if (valueElement) {
            const displayValue = value % 1 === 0 ? value.toString() : value.toFixed(1);
            valueElement.textContent = `${displayValue}/5`;
        }

        const fillElement = document.getElementById(`${dimension}-fill`);
        if (!fillElement) return;

        setTimeout(() => {
            fillElement.style.width = `${percentage}%`;
        }, 500 + (index * 100));
    });
}

function readCssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function updateRadarChart(tasteData) {
    const canvas = document.getElementById('taste-radar');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 84;

    const gridColor = readCssVar('--chart-grid', 'rgba(255,255,255,0.2)');
    const strokeColor = readCssVar('--accent-primary', 'rgba(0, 216, 255, 1)');
    const fillColor = readCssVar('--chart-grid', 'rgba(255,255,255,0.16)');

    const pointColors = [
        readCssVar('--taste-sweet', 'rgba(255, 111, 149, 1)'),
        readCssVar('--taste-sour', 'rgba(243, 203, 88, 1)'),
        readCssVar('--taste-bitter', 'rgba(101, 194, 143, 1)'),
        readCssVar('--taste-strong', 'rgba(255, 158, 87, 1)'),
        readCssVar('--taste-fresh', 'rgba(99, 203, 255, 1)')
    ];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dimensions = [
        { value: tasteData.sweetness, angle: 0 },
        { value: tasteData.sourness, angle: Math.PI * 2 / 5 },
        { value: tasteData.bitterness, angle: Math.PI * 4 / 5 },
        { value: tasteData.strength, angle: Math.PI * 6 / 5 },
        { value: tasteData.freshness, angle: Math.PI * 8 / 5 }
    ];

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    for (let i = 1; i <= 5; i += 1) {
        ctx.beginPath();
        const gridRadius = (radius / 5) * i;
        dimensions.forEach((dim, idx) => {
            const x = centerX + gridRadius * Math.cos(dim.angle - Math.PI / 2);
            const y = centerY + gridRadius * Math.sin(dim.angle - Math.PI / 2);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    dimensions.forEach((dim) => {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + radius * Math.cos(dim.angle - Math.PI / 2),
            centerY + radius * Math.sin(dim.angle - Math.PI / 2)
        );
        ctx.stroke();
    });

    ctx.beginPath();
    dimensions.forEach((dim, idx) => {
        const dataRadius = (radius / 5) * (Number(dim.value) || 0);
        const x = centerX + dataRadius * Math.cos(dim.angle - Math.PI / 2);
        const y = centerY + dataRadius * Math.sin(dim.angle - Math.PI / 2);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    dimensions.forEach((dim, idx) => {
        const dataRadius = (radius / 5) * (Number(dim.value) || 0);
        const x = centerX + dataRadius * Math.cos(dim.angle - Math.PI / 2);
        const y = centerY + dataRadius * Math.sin(dim.angle - Math.PI / 2);

        ctx.beginPath();
        ctx.fillStyle = pointColors[idx];
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

function showAIAnalysisError(message) {
    const errorElement = document.getElementById('ai-analysis-error');
    const title = errorElement?.querySelector('.title');
    const subtitle = errorElement?.querySelector('.subtitle');

    if (title) {
        title.textContent = 'AI分析暂时不可用';
    }
    if (subtitle) {
        subtitle.textContent = message || '请稍后重试或联系管理员';
    }

    showElement(errorElement);
}

function formatAnalysisText(text) {
    if (!text) return '';

    return String(text)
        .split('\n\n')
        .map((paragraph) => {
            const trimmedParagraph = paragraph.trim();
            if (!trimmedParagraph) return '';

            if (trimmedParagraph.includes('**')) {
                const withHeadings = trimmedParagraph.replace(/\*\*(.*?)\*\*/g, (_, heading) => (
                    `<h4 class="analysis-heading">${escapeHTML(heading)}</h4>`
                ));
                if (withHeadings !== trimmedParagraph) return withHeadings;
            }

            if (trimmedParagraph.includes('- ')) {
                const lines = trimmedParagraph.split('\n');
                const formattedLines = [];
                let inList = false;

                lines.forEach((line) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('- ')) {
                        if (!inList) {
                            formattedLines.push('<ul class="analysis-list">');
                            inList = true;
                        }
                        formattedLines.push(`<li>${escapeHTML(trimmedLine.slice(2))}</li>`);
                    } else if (trimmedLine) {
                        if (inList) {
                            formattedLines.push('</ul>');
                            inList = false;
                        }
                        formattedLines.push(`<p class="analysis-paragraph">${escapeHTML(trimmedLine)}</p>`);
                    }
                });

                if (inList) formattedLines.push('</ul>');
                return formattedLines.join('');
            }

            return `<p class="analysis-paragraph">${escapeHTML(trimmedParagraph)}</p>`;
        })
        .filter(Boolean)
        .join('');
}

window.startAITasteAnalysis = startAITasteAnalysis;
