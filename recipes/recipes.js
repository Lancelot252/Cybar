document.addEventListener('DOMContentLoaded', () => {
    const PAGE_LIMIT = 10;
    const DEFAULT_RECIPE_IMAGE = '/uploads/cocktails/jiu.jpg';
    const DEFAULT_AVATAR = '/uploads/avatars/default-avatar.svg';

    const recipesContainer = document.getElementById('recipes-container');
    const loadingMessage = document.getElementById('loading-message');
    const feedStatusArea = document.getElementById('pagination-controls');
    const feedSentinel = document.getElementById('feed-sentinel');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const sortSelect = document.getElementById('sort-select');

    const state = {
        recipes: [],
        currentPage: 0,
        totalPages: 1,
        isLoading: false,
        isEnd: false,
        activeSearch: '',
        activeSort: sortSelect ? sortSelect.value : 'default',
        requestId: 0,
        columnCount: 0
    };

    let feedObserver = null;
    let resizeTimer = null;

    function setFeedStatus(type, text, withRetry = false) {
        if (!feedStatusArea) return;
        feedStatusArea.innerHTML = '';

        const status = document.createElement('div');
        status.className = `feed-status feed-status-${type}`;
        status.textContent = text;
        feedStatusArea.appendChild(status);

        if (!withRetry) return;
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'feed-retry-button';
        retryButton.textContent = '重试加载';
        retryButton.addEventListener('click', () => {
            if (state.currentPage === 0) {
                reloadFeed(true);
            } else {
                loadNextPage();
            }
        });
        feedStatusArea.appendChild(retryButton);
    }

    function createRecipeCard(recipe) {
        const article = document.createElement('article');
        article.classList.add('cocktail', 'feed-card', 'ui-card');

        const imageLink = document.createElement('a');
        imageLink.className = 'feed-cover-link card-media';
        imageLink.href = `detail.html?id=${recipe.id}`;
        imageLink.setAttribute('aria-label', `${recipe.name} 封面`);

        const image = document.createElement('img');
        image.className = 'feed-cover';
        image.loading = 'lazy';
        image.src = recipe.image || DEFAULT_RECIPE_IMAGE;
        image.alt = recipe.name || '配方封面';
        image.addEventListener('error', () => {
            if (image.dataset.fallbackApplied === '1') return;
            image.dataset.fallbackApplied = '1';
            image.src = DEFAULT_RECIPE_IMAGE;
        });
        imageLink.appendChild(image);
        article.appendChild(imageLink);

        const header = document.createElement('div');
        header.className = 'card-header';
        const nameHeading = document.createElement('h3');
        const nameLink = document.createElement('a');
        nameLink.href = `detail.html?id=${recipe.id}`;
        const abv = Number(recipe.estimatedAbv);
        nameLink.textContent = `${recipe.name} (~${Number.isFinite(abv) ? abv.toFixed(1) : 'N/A'}% ABV)`;
        nameHeading.appendChild(nameLink);
        header.appendChild(nameHeading);
        article.appendChild(header);

        const creatorInfo = document.createElement('div');
        creatorInfo.classList.add('recipe-creator', 'card-meta');
        const avatarImg = document.createElement('img');
        avatarImg.className = 'feed-creator-avatar';
        avatarImg.src = recipe.creatorAvatar || DEFAULT_AVATAR;
        avatarImg.alt = '头像';
        avatarImg.addEventListener('error', () => {
            if (avatarImg.dataset.fallbackApplied === '1') return;
            avatarImg.dataset.fallbackApplied = '1';
            avatarImg.src = DEFAULT_AVATAR;
        });
        creatorInfo.appendChild(avatarImg);
        const creatorText = document.createElement('span');
        creatorText.textContent = `由 ${recipe.createdBy || '未知用户'} 创建`;
        creatorInfo.appendChild(creatorText);
        article.appendChild(creatorInfo);

        const description = document.createElement('div');
        description.className = 'card-body';
        const descriptionText = document.createElement('p');
        descriptionText.className = 'feed-instructions';
        const rawDescription = (recipe.description || '').trim();
        const rawInstructions = (recipe.instructions || '').trim();
        const sourceText = rawDescription || rawInstructions;

        if (!sourceText) {
            descriptionText.textContent = '描述：无描述';
        } else {
            const maxLength = 100;
            const snippet = sourceText.length > maxLength
                ? `${sourceText.slice(0, maxLength)}...`
                : sourceText;
            descriptionText.textContent = `描述：${snippet}`;
        }
        description.appendChild(descriptionText);
        article.appendChild(description);

        const interactionInfo = document.createElement('div');
        interactionInfo.classList.add('interaction-info', 'feed-interaction-info', 'card-actions');
        const likeCount = recipe.likeCount !== undefined ? recipe.likeCount : 0;
        const favoriteCount = recipe.favoriteCount !== undefined ? recipe.favoriteCount : 0;
        const likesClass = state.activeSort === 'likes' ? 'metric-highlight-likes' : '';
        const favsClass = state.activeSort === 'favorites' ? 'metric-highlight-favorites' : '';
        interactionInfo.innerHTML = `
            <span class="feed-metric ${likesClass}">
                <i class="fa-regular fa-thumbs-up metric-icon" aria-hidden="true"></i>
                <span>${likeCount}</span>
            </span>
            <span class="metric-divider">|</span>
            <span class="feed-metric ${favsClass}">
                <i class="fa-regular fa-bookmark metric-icon" aria-hidden="true"></i>
                <span>${favoriteCount}</span>
            </span>
        `;
        article.appendChild(interactionInfo);

        return article;
    }

    function getColumnCount() {
        if (window.innerWidth <= 767) return 1;
        if (window.innerWidth <= 900) return 2;
        if (window.innerWidth <= 1199) return 3;
        return 4;
    }

    function ensureFeedColumns(force = false) {
        const nextColumnCount = getColumnCount();
        const currentColumns = Array.from(recipesContainer.querySelectorAll('.feed-column'));

        if (!force && state.columnCount === nextColumnCount && currentColumns.length === nextColumnCount) {
            return currentColumns;
        }

        state.columnCount = nextColumnCount;
        recipesContainer.innerHTML = '';

        const fragment = document.createDocumentFragment();
        for (let index = 0; index < nextColumnCount; index += 1) {
            const column = document.createElement('div');
            column.className = 'feed-column';
            column.dataset.columnIndex = String(index);
            fragment.appendChild(column);
        }
        recipesContainer.appendChild(fragment);

        return Array.from(recipesContainer.querySelectorAll('.feed-column'));
    }

    function appendRecipeToShortestColumn(recipe, columns) {
        if (!columns.length) return;

        const card = createRecipeCard(recipe);
        let targetColumn = columns[0];
        let minHeight = columns[0].offsetHeight;

        for (let index = 1; index < columns.length; index += 1) {
            const height = columns[index].offsetHeight;
            if (height < minHeight) {
                minHeight = height;
                targetColumn = columns[index];
            }
        }

        targetColumn.appendChild(card);
    }

    function appendRecipes(recipes) {
        const columns = ensureFeedColumns();
        recipes.forEach(recipe => {
            appendRecipeToShortestColumn(recipe, columns);
        });
    }

    function rerenderRecipes() {
        const columns = ensureFeedColumns(true);
        state.recipes.forEach(recipe => {
            appendRecipeToShortestColumn(recipe, columns);
        });
    }

    function updateFeedStateView() {
        if (state.recipes.length === 0 && !state.isLoading && state.currentPage > 0) {
            setFeedStatus('empty', '没有找到配方。');
            return;
        }
        if (state.isEnd && state.recipes.length > 0) {
            setFeedStatus('end', '没有更多配方了');
            return;
        }
        if (!state.isLoading && state.recipes.length > 0) {
            setFeedStatus('idle', '向下滚动加载更多');
        }
    }

    async function fetchRecipePage(page, requestId) {
        const encodedSearch = encodeURIComponent(state.activeSearch);
        const encodedSort = encodeURIComponent(state.activeSort);
        const response = await fetch(
            `/api/recipes?page=${page}&limit=${PAGE_LIMIT}&search=${encodedSearch}&sort=${encodedSort}`
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (requestId !== state.requestId) {
            return null;
        }
        return data;
    }

    async function loadNextPage() {
        if (state.isLoading || state.isEnd) return;

        const nextPage = state.currentPage + 1;
        const requestId = ++state.requestId;
        state.isLoading = true;

        if (nextPage === 1 && loadingMessage) {
            loadingMessage.textContent = '正在加载配方...';
            loadingMessage.hidden = false;
        }
        setFeedStatus('loading', '正在加载更多配方...');

        try {
            const data = await fetchRecipePage(nextPage, requestId);
            if (!data) return;

            const incoming = Array.isArray(data.recipes) ? data.recipes : [];
            state.currentPage = Number(data.currentPage) || nextPage;
            state.totalPages = Number(data.totalPages) || 1;

            if (nextPage === 1) {
                recipesContainer.innerHTML = '';
                state.recipes = [];
                state.columnCount = 0;
            }

            state.recipes = state.recipes.concat(incoming);
            appendRecipes(incoming);

            state.isEnd = state.currentPage >= state.totalPages || incoming.length === 0;

            if (loadingMessage) {
                loadingMessage.hidden = true;
            }
            updateFeedStateView();
        } catch (error) {
            if (requestId !== state.requestId) return;
            console.error('无法加载配方:', error);
            if (loadingMessage && state.recipes.length === 0) {
                loadingMessage.textContent = '加载配方失败。请稍后重试。';
                loadingMessage.hidden = false;
            }
            setFeedStatus('error', '加载失败，请重试。', true);
        } finally {
            if (requestId === state.requestId) {
                state.isLoading = false;
            }
        }
    }

    function reloadFeed(resetQuery = false) {
        if (resetQuery) {
            state.activeSearch = searchInput ? searchInput.value.trim() : '';
            state.activeSort = sortSelect ? sortSelect.value : 'default';
        }

        state.requestId += 1;
        state.recipes = [];
        state.currentPage = 0;
        state.totalPages = 1;
        state.isLoading = false;
        state.isEnd = false;
        recipesContainer.innerHTML = '';
        state.columnCount = 0;

        if (loadingMessage) {
            loadingMessage.textContent = '正在加载配方...';
            loadingMessage.hidden = false;
        }
        setFeedStatus('loading', '正在加载配方...');
        loadNextPage();
    }

    function setupInfiniteScroll() {
        if (!feedSentinel || typeof IntersectionObserver === 'undefined') {
            return;
        }
        feedObserver = new IntersectionObserver((entries) => {
            const shouldLoad = entries.some(entry => entry.isIntersecting);
            if (shouldLoad) {
                loadNextPage();
            }
        }, {
            root: null,
            rootMargin: '280px 0px 280px 0px',
            threshold: 0.01
        });
        feedObserver.observe(feedSentinel);
    }

    function setupResponsiveMasonry() {
        window.addEventListener('resize', () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                const nextColumnCount = getColumnCount();
                if (nextColumnCount !== state.columnCount && state.recipes.length > 0) {
                    rerenderRecipes();
                }
            }, 120);
        });
    }

    function setupControls() {
        if (searchButton) {
            searchButton.addEventListener('click', () => reloadFeed(true));
        }
        if (searchInput) {
            searchInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    reloadFeed(true);
                }
            });
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', () => reloadFeed(true));
        }
    }

    setupControls();
    setupInfiniteScroll();
    setupResponsiveMasonry();
    reloadFeed(true);
});
