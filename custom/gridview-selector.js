/**
 * 网格视图原料选择器组件
 * 用于展示和选择鸡尾酒原料的JavaScript组件
 */

class IngredientSelector {
    /**
     * 构造函数
     * @param {Object} config 配置选项
     * @param {HTMLElement} config.container 容器元素
     * @param {Function} config.onSelectionChange 选择变化时的回调函数
     */
    constructor(config) {
        this.container = config.container;
        this.onSelectionChange = config.onSelectionChange || function () { };
        this.ingredients = [];
        this.categories = [];
        this.selectedIngredients = [];
        this.currentCategory = 'all';
        this.searchTerm = '';

        // 初始化组件
        this.init();
    }

    /**
     * 初始化组件结构
     */
    init() {
        // 创建组件基本结构
        this.container.classList.add('ingredients-selector-container');
        this.container.innerHTML = `
            <h3 class="ingredients-selector-title">选择原料</h3>
            
            <div class="ingredient-search-container">
                <div class="search-icon-wrapper">
                    <i class="fa fa-search search-icon"></i>
                </div>
                <input type="text" class="ingredient-search" placeholder="搜索原料..." />
            </div>
            
            <div class="ingredient-categories">
                <div class="category-tab active" data-category="all">所有</div>
            </div>
            
            <div class="ingredients-grid"></div>
            
            <div class="ingredient-actions">
                <button class="action-button clear-button">清除选择</button>
                <button class="action-button primary-button">确认选择</button>
            </div>
        `;

        // 获取元素引用
        this.searchInput = this.container.querySelector('.ingredient-search');
        this.categoriesContainer = this.container.querySelector('.ingredient-categories');
        this.ingredientsGrid = this.container.querySelector('.ingredients-grid');
        this.clearButton = this.container.querySelector('.clear-button');
        this.confirmButton = this.container.querySelector('.primary-button');

        // 绑定事件
        this.bindEvents();
    }

    /**
     * 绑定事件处理
     */
    bindEvents() {
        // 搜索事件
        this.searchInput.addEventListener('input', () => {
            this.searchTerm = this.searchInput.value.toLowerCase();
            this.renderIngredients();
        });

        // 分类选择事件
        this.categoriesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-tab')) {
                this.currentCategory = e.target.dataset.category;

                // 更新激活状态
                this.categoriesContainer.querySelectorAll('.category-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                e.target.classList.add('active');

                this.renderIngredients();
            }
        });

        // 清除选择按钮
        this.clearButton.addEventListener('click', () => {
            this.clearSelection();
        });

        // 确认选择按钮
        this.confirmButton.addEventListener('click', () => {
            this.onSelectionChange(this.selectedIngredients);
        });
    }

    /**
     * 设置原料数据
     * @param {Array} ingredients 原料数据数组
     */
    setIngredients(ingredients) {
        this.ingredients = ingredients;

        // 提取分类
        const categoriesSet = new Set();
        this.ingredients.forEach(ingredient => {
            if (ingredient.category) {
                categoriesSet.add(ingredient.category);
            }
        });
        this.categories = Array.from(categoriesSet);

        // 更新分类选项卡
        this.renderCategories();

        // 渲染原料
        this.renderIngredients();
    }

    /**
     * 渲染分类选项卡
     */
    renderCategories() {
        // 保留"所有"选项卡
        this.categoriesContainer.innerHTML = `
            <div class="category-tab ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all">所有</div>
        `;

        // 添加其他分类
        this.categories.forEach(category => {
            // 将分类名首字母大写
            const displayName = this.getCategoryDisplayName(category);

            this.categoriesContainer.innerHTML += `
                <div class="category-tab ${this.currentCategory === category ? 'active' : ''}" 
                     data-category="${category}">${displayName}</div>
            `;
        });
    }

    /**
     * 获取分类的显示名称
     * @param {string} category 分类标识符
     * @returns {string} 分类的显示名称
     */
    getCategoryDisplayName(category) {
        const categoryMap = {
            'spirits': '烈酒',
            'juices': '果汁',
            'mixers': '调和液',
            'bitters': '苦精',
            'syrups': '糖浆',
            'dairy': '乳制品',
            'garnishes': '装饰物'
        };

        return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    /**
     * 渲染原料网格
     */
    renderIngredients() {
        this.ingredientsGrid.innerHTML = '';

        // 筛选原料
        const filteredIngredients = this.ingredients.filter(ingredient => {
            // 应用分类筛选
            const categoryMatch = this.currentCategory === 'all' || ingredient.category === this.currentCategory;

            // 应用搜索筛选
            const searchMatch = !this.searchTerm ||
                ingredient.name.toLowerCase().includes(this.searchTerm);

            return categoryMatch && searchMatch;
        });

        // 渲染原料卡片
        if (filteredIngredients.length > 0) {
            filteredIngredients.forEach(ingredient => {
                const isSelected = this.selectedIngredients.some(item => item.id === ingredient.id);

                const card = document.createElement('div');
                card.className = `ingredient-card ${isSelected ? 'selected' : ''}`;
                card.dataset.id = ingredient.id;

                card.innerHTML = `
                    <div class="ingredient-icon-container">
                        <i class="fa ${ingredient.icon || 'fa-flask'} ingredient-icon"></i>
                    </div>
                    <div class="ingredient-name">${ingredient.name}</div>
                    <div class="ingredient-abv">${ingredient.abv || 'N/A'}</div>
                `;

                // 添加点击事件
                card.addEventListener('click', () => this.toggleIngredient(ingredient));

                this.ingredientsGrid.appendChild(card);
            });
        } else {
            // 无匹配原料时显示提示
            this.ingredientsGrid.innerHTML = `
                <div class="no-ingredients">
                    <i class="fa fa-exclamation-circle"></i>
                    <p>未找到匹配的原料</p>
                </div>
            `;
        }
    }

    /**
     * 切换原料的选中状态
     * @param {Object} ingredient 原料对象
     */
    toggleIngredient(ingredient) {
        const index = this.selectedIngredients.findIndex(item => item.id === ingredient.id);

        if (index === -1) {
            // 添加到选中列表
            this.selectedIngredients.push(ingredient);
        } else {
            // 从选中列表移除
            this.selectedIngredients.splice(index, 1);
        }

        // 更新UI
        this.renderIngredients();

        // 触发回调
        this.onSelectionChange(this.selectedIngredients);
    }

    /**
     * 选择指定ID的原料
     * @param {number} id 原料ID
     */
    selectIngredient(id) {
        const ingredient = this.ingredients.find(item => item.id === id);

        if (ingredient && !this.selectedIngredients.some(item => item.id === id)) {
            this.selectedIngredients.push(ingredient);
            this.renderIngredients();
            this.onSelectionChange(this.selectedIngredients);
        }
    }

    /**
     * 清除所有选择
     */
    clearSelection() {
        this.selectedIngredients = [];
        this.renderIngredients();
        this.onSelectionChange(this.selectedIngredients);
    }

    /**
     * 获取当前选中的原料
     * @returns {Array} 选中的原料数组
     */
    getSelectedIngredients() {
        return [...this.selectedIngredients];
    }
}

// 导出选择器类
window.IngredientSelector = IngredientSelector; 