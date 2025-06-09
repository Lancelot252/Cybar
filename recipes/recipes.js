document.addEventListener('DOMContentLoaded', () => {
    const recipesContainer = document.getElementById('recipes-container');
    const loadingMessage = document.getElementById('loading-message');
    const paginationControls = document.getElementById('pagination-controls');
    let currentPage = 1; // Keep track of the current page

    const displayRecipes = (data) => {
        recipesContainer.innerHTML = ''; // Clear previous recipes or loading message
        loadingMessage.style.display = 'none'; // Hide loading message
        recipesContainer.style.display = 'block'; // Show container

        if (!data.recipes || data.recipes.length === 0) {
            recipesContainer.innerHTML = '<p>没有找到配方。</p>';
            return;
        }

        data.recipes.forEach(recipe => {
            const article = document.createElement('article');
            article.classList.add('cocktail'); // Use existing class for styling

            const nameHeading = document.createElement('h3');
            const nameLink = document.createElement('a');
            // Use recipe.id for the detail link and correct filename
            nameLink.href = `detail.html?id=${recipe.id}`; // Corrected link to detail.html
            // Display name and ABV
            nameLink.textContent = `${recipe.name} (~${
                !isNaN(Number(recipe.estimatedAbv)) ? Number(recipe.estimatedAbv).toFixed(1) : 'N/A'
            }% ABV)`;
            nameHeading.appendChild(nameLink);
            article.appendChild(nameHeading);

            // --- Add Creator Info ---
            const creatorInfo = document.createElement('p');
            creatorInfo.classList.add('recipe-creator'); // Add class for styling
            creatorInfo.textContent = `由 ${recipe.createdBy || '未知用户'} 创建`;
            article.appendChild(creatorInfo);
            // --- End Creator Info ---

            // --- Add Interaction Counts (Likes & Favorites) ---
            const interactionInfo = document.createElement('div');
            interactionInfo.classList.add('interaction-info'); // Add class for styling
            // Use counts directly from the recipe data
            const likeCount = recipe.likeCount !== undefined ? recipe.likeCount : 0;
            const favoriteCount = recipe.favoriteCount !== undefined ? recipe.favoriteCount : 0;
            interactionInfo.textContent = `👍 ${likeCount} | ⭐ ${favoriteCount}`;
            article.appendChild(interactionInfo);
            // --- End Interaction Counts ---

            // Optionally display brief ingredients or instructions here if needed
            const instructions = document.createElement('p');
            // Ensure instructions exist before trying to access substring
            instructions.textContent = `做法：${recipe.instructions ? recipe.instructions.substring(0, 100) + '...' : '无说明'}`; // Example snippet with check
            article.appendChild(instructions);

            recipesContainer.appendChild(article);

            // REMOVED: loadInteractionCounts(recipe.id, article); - Counts are now included directly
        });

        // --- Render Pagination Controls ---
        renderPagination(data.totalPages, data.currentPage);
    };

    // REMOVED: Function to load interaction counts for a recipe (loadInteractionCounts)

    // Function to fetch recipes for a specific page
    const fetchRecipes = async (page = 1) => {
        loadingMessage.style.display = 'block'; // Show loading message
        recipesContainer.style.display = 'none'; // Hide container while loading
        paginationControls.innerHTML = ''; // Clear pagination while loading

        try {
            // Fetch recipes with pagination parameters
            const searchInput = document.getElementById('search-input').value; // 获取搜索框内容
            const encodedSearch = encodeURIComponent(searchInput); // 编码特殊字符
            const response = await fetch(`/api/recipes?page=${page}&limit=10&search=${encodedSearch}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            currentPage = data.currentPage; // Update current page tracker
            displayRecipes(data);
        } catch (error) {
            console.error('无法加载配方:', error);
            loadingMessage.textContent = '加载配方失败。请稍后重试。';
            loadingMessage.style.color = 'red';
            recipesContainer.style.display = 'none'; // Keep container hidden on error
        }
    };

    // Function to render pagination controls
    const renderPagination = (totalPages, currentPage) => {
        paginationControls.innerHTML = ''; // Clear existing controls

        if (totalPages <= 1) {
            return; // No pagination needed for single page
        }

        // Previous Button
        const prevButton = document.createElement('button');
        prevButton.textContent = '上一页';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                fetchRecipes(currentPage - 1);
            }
        });
        paginationControls.appendChild(prevButton);

        // Page Info Span
        const pageInfo = document.createElement('span');
        pageInfo.textContent = ` 第 ${currentPage} / ${totalPages} 页 `;
        pageInfo.style.margin = '0 10px'; // Add some spacing
        paginationControls.appendChild(pageInfo);

        // Next Button
        const nextButton = document.createElement('button');
        nextButton.textContent = '下一页';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                fetchRecipes(currentPage + 1);
            }
        });
        paginationControls.appendChild(nextButton);
    };

    document.getElementById('search-button').addEventListener('click', () => {
        fetchRecipes(1); // 搜索时强制回到第一页
    });

    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchRecipes(1);
        }
    });

    // Initial load of recipes (load page 1)
    fetchRecipes(1);

    // 获取用户推荐
    async function fetchRecommendations() {
        try {
            const response = await fetch('/api/recommendations', {
                credentials: 'include' // 包含认证信息
            });

            if (!response.ok) {
                throw new Error('无法获取推荐');
            }

            const data = await response.json();
            displayRecommendations(data.recommendations);
        } catch (error) {
            console.error('获取推荐失败:', error);
            // 可选：显示错误信息或隐藏推荐区域
            document.getElementById('recommendations-section').style.display = 'none';
        }
    }

    function displayRecommendations(recommendations) {
        const container = document.getElementById('recommendations-container');
        const section = document.getElementById('recommendations-section');

        if (!recommendations || recommendations.length === 0) {
            section.style.display = 'none';
            return;
        }

        container.innerHTML = '';

        recommendations.forEach(recipe => {
            // 使用与经典配方相同的卡片结构
            const article = document.createElement('article');
            article.classList.add('cocktail', 'recommendation-item');

            // 配方名称和ABV（与经典配方相同）
            const nameHeading = document.createElement('h3');
            const nameLink = document.createElement('a');
            nameLink.href = `detail.html?id=${recipe.id}`;
            nameLink.textContent = `${recipe.name} (~${
                !isNaN(Number(recipe.estimatedAbv)) ? 
                Number(recipe.estimatedAbv).toFixed(1) : 'N/A'
            }% ABV)`;
            nameHeading.appendChild(nameLink);
            article.appendChild(nameHeading);

            // 匹配度显示（使用进度条样式）
            const matchContainer = document.createElement('div');
            matchContainer.classList.add('match-container');

            const matchLabel = document.createElement('span');
            matchLabel.textContent = '匹配度:';
            matchLabel.classList.add('match-label');
            matchContainer.appendChild(matchLabel);

            const matchBar = document.createElement('div');
            matchBar.classList.add('match-bar');

            const matchFill = document.createElement('div');
            matchFill.classList.add('match-fill');
            matchFill.style.width = `${recipe.matchPercentage}%`;
            matchFill.textContent = `${recipe.matchPercentage}%`;
            matchBar.appendChild(matchFill);

            matchContainer.appendChild(matchBar);
            article.appendChild(matchContainer);

            // 推荐理由
            if (recipe.reason) {
                const reason = document.createElement('p');
                reason.classList.add('recommendation-reason');
                reason.textContent = recipe.reason;
                article.appendChild(reason);
            }

            container.appendChild(article);
        });

        section.style.display = 'block';
    }

    // 在初始化时检查用户状态并获取推荐
    async function initRecommendations() {
        try {
            // 检查用户是否登录
            const authResponse = await fetch('/api/auth/status');
            const authData = await authResponse.json();

            if (authData.loggedIn) {
                fetchRecommendations();
            } else {
                // 未登录用户不显示推荐
                document.getElementById('recommendations-section').style.display = 'none';
            }
        } catch (error) {
            console.error('检查认证状态失败:', error);
            document.getElementById('recommendations-section').style.display = 'none';
        }
    }
    initRecommendations();
});
