// 原料选择组件的JavaScript逻辑
document.addEventListener('DOMContentLoaded', function () {
    // 全局变量
    let allIngredients = []; // 所有原料数据
    let selectedIngredients = []; // 已选择的原料
    let currentCategory = 'base_alcohol'; // 当前活动的分类标签

    // 初始化函数
    async function initialize() {
        try {
            // 获取所有原料数据
            const response = await fetch('/custom/ingredients.json');
            if (!response.ok) {
                throw new Error('获取原料数据失败');
            }
            const data = await response.json();
            allIngredients = data.ingredients || [];

            // 设置分类按钮点击事件
            setupCategoryTabs();

            // 加载基酒分类（初始显示）
            loadIngredientsForCategory('base_alcohol');

            // 设置搜索功能
            setupSearch();

            // 设置添加原料的事件
            setupAddIngredientEvents();
        } catch (error) {
            console.error('初始化错误:', error);
            alert('加载数据失败，请刷新页面重试');
        }
    }

    // 设置分类标签点击事件
    function setupCategoryTabs() {
        const categoryButtons = document.querySelectorAll('.category-tab');
        categoryButtons.forEach(button => {
            button.addEventListener('click', function () {
                // 移除所有按钮的active类
                categoryButtons.forEach(btn => btn.classList.remove('active'));

                // 为当前点击的按钮添加active类
                this.classList.add('active');

                // 获取并加载对应分类的原料
                const category = this.getAttribute('data-category');
                loadIngredientsForCategory(category);
            });
        });
    }

    // 根据分类加载原料
    function loadIngredientsForCategory(category) {
        currentCategory = category;
        const ingredientsList = document.getElementById('ingredients-list');
        ingredientsList.innerHTML = ''; // 清空现有内容

        // 查找对应分类的数据
        const categoryData = allIngredients.find(cat => cat.category === category);

        // 检查该分类是否存在及是否有数据
        if (!categoryData || !categoryData.items || categoryData.items.length === 0) {
            ingredientsList.innerHTML = '<div class="empty-selection-message">此分类没有可用原料</div>';
            return;
        }

        // 遍历该分类的原料，创建列表项
        categoryData.items.forEach(ingredient => {
            const ingredientItem = document.createElement('div');
            ingredientItem.className = 'ingredient-item';
            ingredientItem.dataset.id = ingredient.id;

            // 判断该原料是否已被选择
            const isSelected = selectedIngredients.some(i => i.id === ingredient.id);
            if (isSelected) {
                ingredientItem.classList.add('selected');
            }

            // 添加原料信息
            ingredientItem.innerHTML = `
                <div class="ingredient-icon"></div>
                <div class="ingredient-details">
                    <div class="ingredient-name">${ingredient.name}</div>
                    <div class="ingredient-abv">${ingredient.abv}% 酒精度</div>
                </div>
                <div class="category-tag">${getCategoryName(category)}</div>
            `;

            // 点击整个项目可以选择原料
            ingredientItem.addEventListener('click', function () {
                toggleIngredientSelection(ingredient);
            });

            ingredientsList.appendChild(ingredientItem);
        });
    }

    // 获取分类的中文名称
    function getCategoryName(category) {
        const categoryMap = {
            'base_alcohol': '基酒',
            'juice': '果汁',
            'syrup': '糖浆',
            'soda': '碳酸饮料',
            'garnish': '装饰',
            'other': '其他'
        };
        return categoryMap[category] || category;
    }

    // 设置搜索功能
    function setupSearch() {
        const searchInput = document.getElementById('ingredient-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                const query = this.value.toLowerCase().trim();
                filterIngredients(query);
            });
        }
    }

    // 过滤原料列表
    function filterIngredients(query) {
        const ingredientItems = document.querySelectorAll('.ingredient-item');

        ingredientItems.forEach(item => {
            const name = item.querySelector('.ingredient-name').textContent.toLowerCase();

            // 如果查询为空或者名称包含查询字符串，则显示；否则隐藏
            if (query === '' || name.includes(query)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // 设置添加原料的事件
    function setupAddIngredientEvents() {
        // 使用事件委托，监听整个原料列表的点击事件
        document.getElementById('ingredients-list').addEventListener('click', function (e) {
            // 如果点击的是原料项或其子元素
            const ingredientItem = e.target.closest('.ingredient-item');
            if (ingredientItem) {
                const ingredientId = ingredientItem.dataset.id;
                // 查找当前分类中的该原料
                const categoryData = allIngredients.find(cat => cat.category === currentCategory);
                if (categoryData) {
                    const ingredient = categoryData.items.find(item => item.id === ingredientId);
                    if (ingredient) {
                        toggleIngredientSelection(ingredient);
                    }
                }
            }
        });

        // 监听已选原料列表的移除按钮点击事件
        document.getElementById('selected-ingredients-list').addEventListener('click', function (e) {
            if (e.target.classList.contains('remove-selected-btn')) {
                const selectedItem = e.target.closest('.selected-ingredient-item');
                if (selectedItem) {
                    const ingredientId = selectedItem.dataset.id;
                    removeIngredientFromSelection(ingredientId);
                }
            }
        });
    }

    // 切换原料的选中状态
    function toggleIngredientSelection(ingredient) {
        const index = selectedIngredients.findIndex(i => i.id === ingredient.id);

        if (index === -1) {
            // 如果原料不在已选列表中，添加它
            addIngredientToSelection(ingredient);
        } else {
            // 如果原料已在列表中，移除它
            removeIngredientFromSelection(ingredient.id);
        }
    }

    // 添加原料到已选列表
    function addIngredientToSelection(ingredient) {
        // 检查是否已经选择了该原料
        if (selectedIngredients.some(i => i.id === ingredient.id)) {
            return; // 已存在，不再添加
        }

        // 添加到已选列表，默认体积为30ml
        const ingredientWithVolume = { ...ingredient, volume: 30 };
        selectedIngredients.push(ingredientWithVolume);

        // 更新UI
        renderSelectedIngredients();
        updateIngredientListUI();
    }

    // 从已选列表中移除原料
    function removeIngredientFromSelection(ingredientId) {
        // 从数组中移除
        selectedIngredients = selectedIngredients.filter(i => i.id !== ingredientId);

        // 更新UI
        renderSelectedIngredients();
        updateIngredientListUI();
    }

    // 更新原料列表UI中的选中状态
    function updateIngredientListUI() {
        const ingredientItems = document.querySelectorAll('.ingredient-item');

        ingredientItems.forEach(item => {
            const id = item.dataset.id;
            if (selectedIngredients.some(i => i.id === id)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // 渲染已选原料列表
    function renderSelectedIngredients() {
        const selectedList = document.getElementById('selected-ingredients-list');
        const selectedCount = document.getElementById('selected-count');

        // 更新计数
        if (selectedCount) {
            selectedCount.textContent = selectedIngredients.length;
        }

        // 清空现有内容
        if (selectedList) {
            selectedList.innerHTML = '';

            // 如果没有选择任何原料，显示提示信息
            if (selectedIngredients.length === 0) {
                selectedList.innerHTML = '<div class="empty-selection-message">请从列表选择原料</div>';
                return;
            }

            // 遍历渲染每个已选原料
            selectedIngredients.forEach(ingredient => {
                const selectedItem = document.createElement('div');
                selectedItem.className = 'selected-ingredient-item';
                selectedItem.dataset.id = ingredient.id;

                selectedItem.innerHTML = `
                    <div class="ingredient-icon"></div>
                    <div class="ingredient-details">
                        <div class="ingredient-name">${ingredient.name}</div>
                        <div class="ingredient-abv">${ingredient.abv}% 酒精度</div>
                    </div>
                    <div class="volume-input-container">
                        <input type="number" class="volume-input" value="${ingredient.volume}" min="0" step="5">
                        <span class="volume-unit">ml</span>
                    </div>
                    <button class="remove-selected-btn" title="移除此原料">×</button>
                `;

                selectedList.appendChild(selectedItem);
            });

            // 为体积输入添加事件监听
            const volumeInputs = document.querySelectorAll('.volume-input');
            volumeInputs.forEach(input => {
                input.addEventListener('input', function () {
                    const selectedItem = this.closest('.selected-ingredient-item');
                    const ingredientId = selectedItem.dataset.id;
                    const volume = parseFloat(this.value) || 0;

                    // 更新选中原料的体积
                    const ingredientIndex = selectedIngredients.findIndex(i => i.id === ingredientId);
                    if (ingredientIndex !== -1) {
                        selectedIngredients[ingredientIndex].volume = volume;
                    }
                });
            });
        }
    }

    // 导出选中的原料数据（可以在其他模块使用）
    window.getSelectedIngredients = function () {
        return [...selectedIngredients];
    };

    // 初始化组件
    initialize();
}); 