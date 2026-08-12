document.addEventListener('DOMContentLoaded', initProfilePage);

let feedbackTimer = null;
let createdRecipesContainer = null;

function initProfilePage() {
    bindAvatarUpload();
    bindSignatureActions();
    bindTabs();

    createdRecipesContainer = document.getElementById('created-recipes-list');
    if (createdRecipesContainer) {
        createdRecipesContainer.addEventListener('click', handleCreatedRecipeActions);
    }

    loadAllData();
}

function bindAvatarUpload() {
    const avatarImg = document.getElementById('user-avatar');
    const avatarInput = document.getElementById('avatar-input');
    const avatarTrigger = document.getElementById('avatar-trigger');
    const avatarPanel = document.querySelector('.avatar-panel');

    if (!avatarImg || !avatarInput || !avatarTrigger || !avatarPanel) {
        return;
    }

    const openPicker = () => avatarInput.click();

    avatarImg.addEventListener('click', openPicker);
    avatarTrigger.addEventListener('click', openPicker);

    avatarInput.addEventListener('change', async () => {
        const file = avatarInput.files[0];
        if (!file) {
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setFeedback('error', '头像文件不能超过 5MB');
            avatarInput.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        avatarPanel.classList.add('uploading');
        avatarTrigger.setAttribute('aria-busy', 'true');
        avatarTrigger.textContent = '上传中...';

        try {
            const data = await fetchJSON('/api/user/avatar', {
                method: 'POST',
                body: formData
            });

            if (data.avatarUrl) {
                avatarImg.src = `${data.avatarUrl}?t=${Date.now()}`;
                setFeedback('success', '头像已更新');
            } else {
                setFeedback('error', data.message || '头像上传失败');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            setFeedback('error', error.message || '上传失败，请稍后重试');
        } finally {
            avatarPanel.classList.remove('uploading');
            avatarTrigger.removeAttribute('aria-busy');
            avatarTrigger.innerHTML = '<i class="fas fa-camera"></i> 更换头像';
            avatarInput.value = '';
        }
    });
}

function bindSignatureActions() {
    const signatureInput = document.getElementById('signature-input');
    const saveButton = document.getElementById('save-signature-btn');
    const signatureCount = document.getElementById('signature-count');

    if (!signatureInput || !saveButton || !signatureCount) {
        return;
    }

    const updateSignatureCount = () => {
        signatureCount.textContent = `${signatureInput.value.length} / 50`;
    };

    updateSignatureCount();
    signatureInput.addEventListener('input', updateSignatureCount);

    saveButton.addEventListener('click', async () => {
        const newSignature = signatureInput.value.trim();

        if (newSignature.length > 50) {
            setFeedback('error', '签名长度不能超过 50 字');
            return;
        }

        saveButton.disabled = true;
        saveButton.setAttribute('aria-busy', 'true');
        saveButton.textContent = '保存中...';

        try {
            await fetchJSON('/api/user/signature', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ signature: newSignature })
            });

            setFeedback('success', '签名保存成功');
        } catch (error) {
            console.error('Error saving signature:', error);
            setFeedback('error', error.message || '签名保存失败');
        } finally {
            saveButton.disabled = false;
            saveButton.removeAttribute('aria-busy');
            saveButton.textContent = '保存签名';
        }
    });
}

function bindTabs() {
    const tabs = Array.from(document.querySelectorAll('.tab-button'));
    const panels = Array.from(document.querySelectorAll('.tab-content'));

    if (!tabs.length || !panels.length) {
        return;
    }

    const activateTab = (tab) => {
        const targetId = `${tab.dataset.tab}-content`;

        tabs.forEach((currentTab) => {
            const isActive = currentTab === tab;
            currentTab.classList.toggle('active', isActive);
            currentTab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            currentTab.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        panels.forEach((panel) => {
            const isActive = panel.id === targetId;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });
    };

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateTab(tab));

        tab.addEventListener('keydown', (event) => {
            let nextIndex = null;

            if (event.key === 'ArrowRight') {
                nextIndex = (index + 1) % tabs.length;
            } else if (event.key === 'ArrowLeft') {
                nextIndex = (index - 1 + tabs.length) % tabs.length;
            } else if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = tabs.length - 1;
            }

            if (nextIndex !== null) {
                event.preventDefault();
                tabs[nextIndex].focus();
                activateTab(tabs[nextIndex]);
            }
        });
    });

    activateTab(tabs[0]);
}

async function loadAllData() {
    setLoadingState('likes-list', true);
    setLoadingState('favorites-list', true);
    setLoadingState('created-recipes-list', true);

    try {
        const user = await fetchJSON('/api/user/current');
        renderUser(user);

        const [likesResult, favoritesResult, createdResult] = await Promise.allSettled([
            fetchJSON('/api/user/likes'),
            fetchJSON('/api/user/favorites'),
            fetchJSON('/api/user/created-recipes')
        ]);

        const likes = likesResult.status === 'fulfilled' ? likesResult.value : [];
        const favorites = favoritesResult.status === 'fulfilled' ? favoritesResult.value : [];
        const created = createdResult.status === 'fulfilled' ? createdResult.value : [];

        if (likesResult.status === 'fulfilled') {
            renderRecipeList(likes, 'likes-list');
        } else {
            renderListError('likes-list', '点赞历史加载失败');
            console.error('Error loading likes:', likesResult.reason);
        }

        if (favoritesResult.status === 'fulfilled') {
            renderRecipeList(favorites, 'favorites-list');
        } else {
            renderListError('favorites-list', '收藏历史加载失败');
            console.error('Error loading favorites:', favoritesResult.reason);
        }

        if (createdResult.status === 'fulfilled') {
            renderRecipeList(created, 'created-recipes-list', { isMyCreations: true });
        } else {
            renderListError('created-recipes-list', '创建历史加载失败');
            console.error('Error loading created recipes:', createdResult.reason);
        }

        renderStats({
            likes: likes.length,
            favorites: favorites.length,
            created: created.length
        });

        if (likesResult.status === 'rejected' || favoritesResult.status === 'rejected' || createdResult.status === 'rejected') {
            setFeedback('error', '部分内容加载失败，请稍后重试');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        setFeedback('error', error.message || '个人中心加载失败，请稍后重试');
    }
}

function renderUser(user) {
    const usernameEl = document.getElementById('username');
    const avatarImg = document.getElementById('user-avatar');
    const signatureInput = document.getElementById('signature-input');
    const signatureCount = document.getElementById('signature-count');

    if (usernameEl) {
        usernameEl.textContent = user.username || '未知用户';
    }

    if (avatarImg) {
        avatarImg.src = user.avatar || '/uploads/avatars/test.jpg';
    }

    if (signatureInput) {
        signatureInput.value = user.signature || '';
    }

    if (signatureCount) {
        const count = signatureInput ? signatureInput.value.length : 0;
        signatureCount.textContent = `${count} / 50`;
    }
}

function renderStats({ likes, favorites, created }) {
    const likesCount = document.getElementById('likes-stat-count');
    const favoritesCount = document.getElementById('favorites-stat-count');
    const createdCount = document.getElementById('created-stat-count');

    if (likesCount) {
        likesCount.textContent = String(likes);
    }

    if (favoritesCount) {
        favoritesCount.textContent = String(favorites);
    }

    if (createdCount) {
        createdCount.textContent = String(created);
    }
}

function renderRecipeList(recipes, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!Array.isArray(recipes) || recipes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'state-empty';
        empty.textContent = '暂无数据';
        container.appendChild(empty);
        return;
    }

    recipes.forEach((recipe) => {
        const card = document.createElement('article');
        card.className = 'recipe-card';

        const title = document.createElement('h4');
        title.className = 'recipe-title';
        title.textContent = recipe.name || '未命名配方';

        const creator = document.createElement('p');
        creator.className = 'recipe-meta';
        creator.textContent = `创建者：${recipe.createdBy || '未知用户'}`;

        const abv = document.createElement('p');
        abv.className = 'recipe-meta';
        abv.textContent = `预计酒精度：${recipe.estimatedAbv ?? '--'}%`;

        const actions = document.createElement('div');
        actions.className = 'recipe-actions';

        const viewLink = document.createElement('a');
        viewLink.href = `/recipes/detail.html?id=${encodeURIComponent(recipe.id)}`;
        viewLink.className = 'view-recipe';
        viewLink.innerHTML = '<i class="fas fa-eye"></i> 查看详情';

        actions.appendChild(viewLink);

        if (options.isMyCreations) {
            const editLink = document.createElement('a');
            editLink.href = `/custom/?id=${encodeURIComponent(recipe.id)}`;
            editLink.className = 'recipe-action-btn';
            editLink.innerHTML = '<i class="fas fa-edit"></i> 修改';

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'recipe-action-btn danger delete-recipe-btn';
            deleteButton.dataset.recipeId = String(recipe.id);
            deleteButton.dataset.recipeName = recipe.name || '未命名配方';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i> 删除';

            actions.appendChild(editLink);
            actions.appendChild(deleteButton);
        }

        card.appendChild(title);
        card.appendChild(creator);
        card.appendChild(abv);
        card.appendChild(actions);
        container.appendChild(card);
    });
}

function setFeedback(type, message) {
    const feedbackEl = document.getElementById('profile-feedback');
    if (!feedbackEl) {
        return;
    }

    if (feedbackTimer) {
        clearTimeout(feedbackTimer);
    }

    feedbackEl.className = 'profile-feedback';

    if (!message) {
        feedbackEl.textContent = '';
        feedbackEl.hidden = true;
        return;
    }

    feedbackEl.classList.add(`state-${type}`);
    feedbackEl.textContent = message;
    feedbackEl.hidden = false;

    feedbackTimer = setTimeout(() => {
        feedbackEl.hidden = true;
        feedbackEl.textContent = '';
        feedbackEl.className = 'profile-feedback';
    }, type === 'error' ? 4500 : 3000);
}

function setLoadingState(containerId, isLoading) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    if (isLoading) {
        container.innerHTML = '<div class="state-loading">加载中...</div>';
    }
}

function renderListError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.innerHTML = `<div class="state-error">${message}</div>`;
}

async function handleCreatedRecipeActions(event) {
    const button = event.target.closest('.delete-recipe-btn');
    if (!button) {
        return;
    }

    const recipeId = button.dataset.recipeId;
    const recipeName = button.dataset.recipeName || '该配方';

    if (!recipeId) {
        return;
    }

    if (!window.confirm(`确定要删除配方“${recipeName}”吗？此操作不可恢复。`)) {
        return;
    }

    button.disabled = true;

    try {
        await fetchJSON(`/api/custom/cocktails/${encodeURIComponent(recipeId)}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        setFeedback('success', '配方删除成功');
        await loadAllData();
    } catch (error) {
        console.error('Error deleting recipe:', error);
        setFeedback('error', error.message || '删除失败，请稍后重试');
    } finally {
        button.disabled = false;
    }
}

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
        window.location.href = '/auth/login/';
        throw new Error('请先登录');
    }

    if (response.redirected && response.url.includes('/auth/login')) {
        window.location.href = '/auth/login/';
        throw new Error('登录状态失效');
    }

    const contentType = response.headers.get('content-type') || '';
    const isJSON = contentType.includes('application/json');

    if (!isJSON) {
        if (!response.ok) {
            throw new Error('请求失败，请稍后重试');
        }
        throw new Error('服务器返回格式异常');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || '请求失败');
    }

    return data;
}
