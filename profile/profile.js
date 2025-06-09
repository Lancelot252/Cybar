document.addEventListener('DOMContentLoaded', () => {
    // 获取用户信息
    fetch('/api/user/current')
        .then(response => response.json())
        .then(user => {
            document.getElementById('username').textContent = user.username;
        })
        .catch(error => {
            console.error('Error fetching user info:', error);
            window.location.href = '/auth/login/';
        });

    // 加载用户的点赞和收藏数据
    loadUserInteractions();

    // 标签切换功能
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有标签的active类
            tabs.forEach(t => t.classList.remove('active'));
            // 添加当前标签的active类
            tab.classList.add('active');

            // 隐藏所有内容
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            // 显示当前标签对应的内容
            const contentId = `${tab.dataset.tab}-content`;
            document.getElementById(contentId).classList.add('active');
        });
    });
});

async function loadUserInteractions() {
    try {
        // 加载点赞历史
        const likesResponse = await fetch('/api/user/likes');
        const likesData = await likesResponse.json();
        displayRecipes(likesData, 'likes-list');

        // 加载收藏历史
        const favoritesResponse = await fetch('/api/user/favorites');
        const favoritesData = await favoritesResponse.json();
        displayRecipes(favoritesData, 'favorites-list');

        // 加载创建的配方历史
        const createdRecipesResponse = await fetch('/api/user/created-recipes');
        const createdRecipesData = await createdRecipesResponse.json();
        displayRecipes(createdRecipesData, 'created-recipes-list');

    } catch (error) {
        console.error('Error loading user interactions:', error);
        showError('加载数据时出错，请稍后重试');
    }
}

function displayRecipes(recipes, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // 清除加载提示

    // 防御性处理
    if (!Array.isArray(recipes)) {
        container.innerHTML = '<p class="no-data">暂无数据</p>';
        return;
    }

    if (recipes.length === 0) {
        container.innerHTML = '<p class="no-data">暂无数据</p>';
        return;
    }

    recipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.innerHTML = `
            <h4>${recipe.name}</h4>
            <p>创建者: ${recipe.createdBy || '未知用户'}</p>
            <p>预计酒精度: ${recipe.estimatedAbv}%</p>
            <a href="/recipes/detail.html?id=${recipe.id}" class="view-recipe">查看详情</a>
        `;
        container.appendChild(card);
    });
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.getElementById('profile-content').prepend(errorDiv);
    
    // 3秒后自动移除错误消息
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}