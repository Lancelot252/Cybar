// 自定义鸡尾酒创建器的JavaScript逻辑
document.addEventListener('DOMContentLoaded', function () {
    // 全局变量
    let allIngredients = {}; // 所有原料数据
    let selectedIngredients = []; // 已选择的原料
    // 使用 ingredients.json 中的 category 值作为默认（例如: 'base_alcohol'）
    let currentCategoryTab = 'base_alcohol'; // 当前活动的分类标签

    // 分类顺序和名称映射 - 与后端API返回的数据结构完全对应
    const CATEGORY_ORDER = ['base_alcohol', 'liqueurs', 'vermouth_wine', 'bitters', 'juice', 'syrup', 'soda_mixer', 'dairy_cream', 'other'];
    const CATEGORY_NAMES = {
        'base_alcohol': '基酒',
        'liqueurs': '力娇酒/利口酒',
        'vermouth_wine': '味美思/加强葡萄酒',
        'bitters': '苦精',
        'juice': '果汁',
        'syrup': '糖浆',
        'soda_mixer': '碳酸/调配饮料',
        'dairy_cream': '奶制品',
        'other': '其他'
    };

    // 初始化函数
    async function initialize() {
        try {
            console.log('正在初始化自定义调酒界面...');

            // 获取所有原料数据
            console.log('正在获取原料数据...');
            const response = await fetch('/api/custom/ingredients');

            // 添加详细日志
            console.log('API响应状态:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`获取原料数据失败: HTTP ${response.status} - ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('API响应内容长度:', responseText.length);

            try {
                // 尝试解析JSON
                allIngredients = JSON.parse(responseText);
                console.log('原料数据解析成功:', allIngredients);
            } catch (parseError) {
                console.error('JSON解析错误:', parseError);
                console.error('收到的响应文本:', responseText.substring(0, 200) + '...');
                throw new Error('解析原料数据失败: ' + parseError.message);
            }

            // 确保数据结构正确
            if (!allIngredients.ingredients || !Array.isArray(allIngredients.ingredients)) {
                console.error('原料数据格式不正确:', allIngredients);
                showErrorMessage('原料数据格式不正确，请联系管理员');
                return;
            }

            // 确认每个分类
            console.log('可用原料分类:');
            allIngredients.ingredients.forEach(category => {
                console.log(`- ${category.category}: ${category.items ? category.items.length : 0} 个原料`);
            });

            // 加载基酒分类（初始显示，使用 JSON 中的 category key）
            console.log('加载基酒分类...');
            loadIngredientsForCategory('base_alcohol');

            // 渲染分类标签（替换页面中的静态按钮），并设置事件监听器
            console.log('渲染分类标签并设置事件监听器...');
            renderCategoryTabs();
            setupEventListeners();

            // 初始化酒精含量计算
            updateAbvCalculation();

            // 初始化动画
            const cocktailAnimation = document.querySelector('.cocktail-glass');
            if (cocktailAnimation) {
                cocktailAnimation.classList.add('abv-0');
            }

            console.log('初始化完成');
        } catch (error) {
            console.error('初始化错误:', error);
            showErrorMessage('加载数据失败: ' + error.message);

            // 显示错误在界面上
            document.getElementById('ingredients-list').innerHTML = `
                <div class="error-message">
                    <p>加载原料数据失败</p>
                    <p>错误信息: ${error.message}</p>
                    <button onclick="window.location.reload()">重新加载</button>
                </div>
            `;
        }
    }

    // 根据分类加载原料
    function loadIngredientsForCategory(category) {
        console.log(`加载分类 ${category} 的原料...`);
        const ingredientsList = document.getElementById('ingredients-list');
        ingredientsList.innerHTML = ''; // 清空现有内容
    // 直接使用 JSON 中的 category key（例如: base_alcohol, liqueurs, vermouth_wine, bitters, juice, syrup, soda_mixer, dairy_cream, other）
    const jsonCategory = category;

        // 查找对应分类的原料
        if (!allIngredients || !allIngredients.ingredients) {
            console.error('原料数据结构不正确:', allIngredients);
            ingredientsList.innerHTML = '<div class="no-ingredients-message">加载原料数据失败</div>';
            return;
        }

        // 若 category 为 'all'，合并所有分类条目
        let categoryObj = null;
        if (jsonCategory === 'all') {
            // 创建一个合并对象，items 为所有分类的拼接
            const allItems = [];
            allIngredients.ingredients.forEach(cat => {
                if (Array.isArray(cat.items)) allItems.push(...cat.items.map(i => ({...i, _src_category: cat.category}))); 
            });
            categoryObj = { category: 'all', items: allItems };
        } else {
            categoryObj = allIngredients.ingredients.find(cat => cat.category === jsonCategory);
        }
        console.log('找到的分类对象:', categoryObj);

        // 检查该分类是否有数据
        if (!categoryObj || !categoryObj.items || categoryObj.items.length === 0) {
            console.log(`分类 ${jsonCategory} 没有原料数据`);
            ingredientsList.innerHTML = '<div class="no-ingredients-message">此分类没有可用原料</div>';
            return;
        }

        const categoryData = categoryObj.items;
        console.log(`找到 ${categoryData.length} 个原料`);

        // 创建网格容器
        const gridContainer = document.createElement('div');
        gridContainer.className = 'ingredients-grid';

        // 遍历该分类的原料，创建网格项
        categoryData.forEach(ingredient => {
            console.log(`创建原料项: ${ingredient.name}`);
            const ingredientItem = document.createElement('div');
            ingredientItem.className = 'ingredient-item';
            ingredientItem.dataset.id = ingredient.id;

            // 将来源分类记录在 dataset（用于'all'视图时区分颜色显示）
            if (ingredient._src_category) ingredientItem.dataset.category = ingredient._src_category;

            // 判断该原料是否已被选择
            const isSelected = selectedIngredients.some(i => i.id === ingredient.id);
            if (isSelected) {
                ingredientItem.classList.add('selected');
            }

            // 为不同分类设置不同的图标颜色 - 基于后端API返回的分类结构
            // 颜色映射与CATEGORY_ORDER保持一致
            const iconColors = {
                'base_alcohol': '#FF9800',  // 橙色 - 基酒
                'liqueurs': '#FF5722',      // 橙红色 - 力娇酒/利口酒  
                'vermouth_wine': '#795548', // 棕色 - 味美思/加强葡萄酒
                'bitters': '#6A1B9A',       // 深紫色 - 苦精
                'juice': '#4CAF50',         // 绿色 - 果汁
                'syrup': '#E91E63',         // 粉色 - 糖浆
                'soda_mixer': '#2196F3',    // 蓝色 - 碳酸/调配饮料
                'dairy_cream': '#9C27B0',   // 紫色 - 奶制品
                'other': '#607D8B'          // 灰蓝色 - 其他
            };

            // 如果显示的是合并视图('all')，优先使用原料自身的来源分类来选择颜色
            const itemCategoryForColor = ingredient._src_category || jsonCategory;
            const iconColor = iconColors[itemCategoryForColor] || '#607D8B';

            // 设置原料图标和详细信息
            // 确保使用正确的单位，优先使用原料自身定义的单位
            const displayUnit = ingredient.unit && ingredient.unit !== '' ? ingredient.unit : '毫升';
            const abvDisplay = ingredient.abv > 0 ? `${ingredient.abv}% ABV` : `(${displayUnit})`;

            ingredientItem.innerHTML = `
                <div class="ingredient-card">
                    <div class="ingredient-icon" style="background-color: ${iconColor};">${ingredient.name.charAt(0)}</div>
                    <div class="ingredient-details">
                        <div class="ingredient-name">${ingredient.name}</div>
                        <div class="ingredient-abv">${abvDisplay}</div>
                    </div>
                    <button class="add-ingredient-btn" title="添加此原料">+</button>
                </div>
            `;

            gridContainer.appendChild(ingredientItem);
        });

        ingredientsList.appendChild(gridContainer);

        // 更新分类标签的活动状态（dataset.category 应当包含 JSON 的 category key）
        document.querySelectorAll('.category-tab').forEach(tab => {
            if (tab.dataset.category === jsonCategory) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        currentCategoryTab = category;
    }

    // 设置所有事件监听器
    function setupEventListeners() {
        // 1. 分类标签点击事件（事件委托到容器，确保动态渲染的按钮也能响应）
        const categoriesContainer = document.getElementById('ingredient-categories');
        if (categoriesContainer) {
            categoriesContainer.addEventListener('click', function (e) {
                const tab = e.target.closest('.category-tab');
                if (!tab) return;
                const category = tab.dataset.category;
                console.log('分类标签点击(委托):', category);

                // 更新 UI active 状态
                document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                loadIngredientsForCategory(category);
            });
        }

        // 2. 搜索功能
        const searchInput = document.getElementById('ingredient-search');
        searchInput.addEventListener('input', function () {
            filterIngredients(this.value);
        });

        // 3. 添加原料按钮点击事件（使用事件委托）
        document.getElementById('ingredients-list').addEventListener('click', function (e) {
            const addButton = e.target.closest('.add-ingredient-btn');
            if (addButton) {
                console.log('添加原料按钮点击');
                const ingredientItem = addButton.closest('.ingredient-item');
                const ingredientId = ingredientItem.dataset.id;
                console.log('添加原料ID:', ingredientId);
                addIngredientToSelection(ingredientId);
            }
        });

        // 4. 添加步骤按钮点击事件
        document.getElementById('add-step-btn').addEventListener('click', addPreparationStep);

        // 5. 移除步骤按钮点击事件（使用事件委托）
        document.getElementById('steps-container').addEventListener('click', function (e) {
            if (e.target.classList.contains('remove-step-btn')) {
                const stepItem = e.target.closest('.step-item');
                if (document.querySelectorAll('.step-item').length > 1) {
                    stepItem.remove();
                    renumberSteps();
                } else {
                    showErrorMessage('至少需要保留一个步骤');
                }
            }
        });

        // 6. 保存鸡尾酒按钮点击事件
        document.getElementById('save-cocktail-btn').addEventListener('click', saveCustomCocktail);

        // 7. 取消按钮点击事件
        document.getElementById('cancel-btn').addEventListener('click', function () {
            if (confirm('确定要取消创建？所有未保存的修改将丢失。')) {
                window.location.href = '/';
            }
        });

        // 8. 已选原料列表中的移除按钮（使用事件委托）
        document.getElementById('selected-ingredients-list').addEventListener('click', function (e) {
            const removeButton = e.target.closest('.remove-selected-btn');
            if (removeButton) {
                console.log('移除原料按钮点击');
                const selectedItem = removeButton.closest('.selected-ingredient-item');
                const ingredientId = selectedItem.dataset.id;
                console.log('移除原料ID:', ingredientId);
                removeIngredientFromSelection(ingredientId);
            }
        });

        // 9. 体积输入变化事件（使用事件委托）
        document.getElementById('selected-ingredients-list').addEventListener('input', function (e) {
            if (e.target.classList.contains('volume-input')) {
                const selectedItem = e.target.closest('.selected-ingredient-item');
                const ingredientId = selectedItem.dataset.id;
                const volume = parseFloat(e.target.value) || 0;

                // 更新选中原料的体积
                const ingredientIndex = selectedIngredients.findIndex(i => i.id === ingredientId);
                if (ingredientIndex !== -1) {
                    selectedIngredients[ingredientIndex].volume = volume;
                    updateAbvCalculation();
                }
            }
        });
    }

    // 动态渲染分类标签到页面上的 #ingredient-categories（替换静态按钮）
    function renderCategoryTabs() {
        const container = document.getElementById('ingredient-categories');
        if (!container) return;

        // 清空现有内容
        container.innerHTML = '';

        // 添加“全部”选项
        const allBtn = document.createElement('button');
        allBtn.className = 'category-tab' + (currentCategoryTab === 'all' ? ' active' : '');
        allBtn.dataset.category = 'all';
        allBtn.textContent = '全部';
        container.appendChild(allBtn);

        // 按既定顺序渲染分类，只渲染后端API实际返回的分类
        CATEGORY_ORDER.forEach(catKey => {
            // 检查该分类是否在API返回的数据中存在
            const hasCat = allIngredients.ingredients && allIngredients.ingredients.some(c => c.category === catKey);
            if (!hasCat) {
                console.log(`跳过不存在的分类: ${catKey}`);
                return;
            }

            const btn = document.createElement('button');
            btn.className = 'category-tab' + (currentCategoryTab === catKey ? ' active' : '');
            btn.dataset.category = catKey;
            btn.textContent = CATEGORY_NAMES[catKey] || catKey;
            container.appendChild(btn);
        });
        
        console.log('已渲染分类标签:', container.children.length, '个');
    }

    // 过滤原料列表
    function filterIngredients(query) {
        query = query.toLowerCase().trim();

        // 获取当前显示的分类下的所有原料项
        const ingredientItems = document.querySelectorAll('.ingredient-item');

        // 如果查询为空，则显示所有项
        if (query === '') {
            ingredientItems.forEach(item => {
                item.style.display = '';
            });
            return;
        }

        // 遍历并根据查询过滤原料项
        ingredientItems.forEach(item => {
            const nameElement = item.querySelector('.ingredient-name');
            if (nameElement) {
                const name = nameElement.textContent.toLowerCase();
                // 如果名称包含查询字符串，则显示；否则隐藏
                if (name.includes(query)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            }
        });

        // 如果没有匹配项，显示提示信息
        const visibleItems = document.querySelectorAll('.ingredient-item[style=""]');
        const noResults = visibleItems.length === 0;

        const noResultsMessage = document.querySelector('.no-results-message');
        if (noResults) {
            if (!noResultsMessage) {
                const message = document.createElement('div');
                message.className = 'no-results-message';
                message.textContent = `没有找到匹配 "${query}" 的原料`;
                document.getElementById('ingredients-list').appendChild(message);
            }
        } else {
            if (noResultsMessage) {
                noResultsMessage.remove();
            }
        }
    }

    // 添加原料到已选列表
    function addIngredientToSelection(ingredientId) {
        // 在分类中查找原料
        let selectedIngredient = null;
        let found = false;

        // 遍历所有分类查找原料
        for (const categoryObj of allIngredients.ingredients) {
            const ingredient = categoryObj.items.find(item => item.id === ingredientId);
            if (ingredient) {
                // 根据单位设置默认数量
                let defaultVolume = 30; // 默认毫升
                if (ingredient.unit === '滴') {
                    defaultVolume = 3;
                } else if (ingredient.unit === '片') {
                    defaultVolume = 1;
                } else if (ingredient.unit === '个') {
                    defaultVolume = 1;
                } else if (ingredient.unit === '颗') {
                    defaultVolume = 2;
                } else if (ingredient.unit === '根') {
                    defaultVolume = 1;
                } else if (ingredient.unit === '茶匙') {
                    defaultVolume = 1;
                }

                selectedIngredient = {
                    ...ingredient,
                    volume: defaultVolume,
                    category: categoryObj.category // 保存原料分类
                };
                found = true;
                break;
            }
        }

        if (!found || !selectedIngredient) {
            console.error('找不到指定ID的原料:', ingredientId);
            return;
        }

        // 检查是否已经选择了该原料
        if (selectedIngredients.some(i => i.id === ingredientId)) {
            showErrorMessage('该原料已被选择');
            return;
        }

        // 添加到已选列表
        selectedIngredients.push(selectedIngredient);

        // 更新显示
        renderSelectedIngredients();
        updateAbvCalculation();

        // 更新原料项在列表中的显示状态
        const ingredientItem = document.querySelector(`.ingredient-item[data-id="${ingredientId}"]`);
        if (ingredientItem) {
            ingredientItem.classList.add('selected');
        }
    }

    // 从已选列表中移除原料
    function removeIngredientFromSelection(ingredientId) {
        // 从已选列表中移除
        selectedIngredients = selectedIngredients.filter(i => i.id !== ingredientId);

        // 更新显示
        renderSelectedIngredients();
        updateAbvCalculation();

        // 更新原料项在列表中的显示状态
        const ingredientItem = document.querySelector(`.ingredient-item[data-id="${ingredientId}"]`);
        if (ingredientItem) {
            ingredientItem.classList.remove('selected');
        }
    }

    // 渲染已选原料列表
    function renderSelectedIngredients() {
        const selectedList = document.getElementById('selected-ingredients-list');
        const selectedCount = document.getElementById('selected-count');

        // 更新选中数量
        selectedCount.textContent = selectedIngredients.length;

        // 判断是否有选中的原料
        if (selectedIngredients.length === 0) {
            selectedList.innerHTML = '<div class="empty-selection-message">请从右侧列表选择原料</div>';
            return;
        }

        // 清空并重新填充列表
        selectedList.innerHTML = '';

        // 将原料按类别分组
        const groupedIngredients = {};

        selectedIngredients.forEach(ingredient => {
            const category = ingredient.category;
            if (!groupedIngredients[category]) {
                groupedIngredients[category] = [];
            }
            groupedIngredients[category].push(ingredient);
        });

        // 按全局定义的顺序创建分类分组（使用统一的常量）
        CATEGORY_ORDER.forEach(category => {
            if (groupedIngredients[category] && groupedIngredients[category].length > 0) {
                // 创建分类标题
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'selected-category-header';
                categoryHeader.textContent = CATEGORY_NAMES[category] || category;
                selectedList.appendChild(categoryHeader);

                // 创建该分类下的所有原料项
                groupedIngredients[category].forEach(ingredient => {
                    const selectedItem = document.createElement('div');
                    selectedItem.className = 'selected-ingredient-item';
                    selectedItem.dataset.id = ingredient.id;

                    // 确保使用正确的单位
                    const displayUnit = ingredient.unit && ingredient.unit !== '' ? ingredient.unit : '毫升';

                    selectedItem.innerHTML = `
                        <div class="selected-ingredient-name">${ingredient.name}</div>
                        <div class="selected-ingredient-volume">
                            <input type="number" class="volume-input" value="${ingredient.volume}" min="0" max="1000" step="5">
                            <span class="volume-unit">${displayUnit}</span>
                        </div>
                        <button class="remove-selected-btn" title="移除此原料">×</button>
                    `;

                    selectedList.appendChild(selectedItem);
                });
            }
        });
    }

    // 更新酒精含量计算
    function updateAbvCalculation() {
        const calculatedAbvElement = document.getElementById('calculated-abv');
        const abvDescriptionElement = document.getElementById('abv-description');
        const cocktailAnimation = document.querySelector('.cocktail-glass');

        // 如果没有选择原料，显示0%
        if (selectedIngredients.length === 0) {
            calculatedAbvElement.textContent = '0.0%';
            abvDescriptionElement.textContent = '无酒精或低度酒精，适合任何人饮用';

            // 重置动画颜色类
            resetAbvClasses(cocktailAnimation);
            return;
        }

        // 计算总体积和总酒精体积
        let totalVolume = 0;
        let totalAlcoholVolume = 0;

        selectedIngredients.forEach(ingredient => {
            const volume = ingredient.volume || 0;
            const abv = ingredient.abv || 0;

            totalVolume += volume;
            totalAlcoholVolume += (volume * abv / 100);
        });

        // 计算平均酒精含量
        let calculatedAbv = totalVolume > 0 ? (totalAlcoholVolume / totalVolume) * 100 : 0;

        // 四舍五入到小数点后一位
        calculatedAbv = Math.round(calculatedAbv * 10) / 10;

        // 更新显示
        calculatedAbvElement.textContent = `${calculatedAbv.toFixed(1)}%`;

        // 根据酒精度数设置描述和颜色
        let description = '';
        let color = '';

        // 重置动画颜色类
        resetAbvClasses(cocktailAnimation);

        if (calculatedAbv === 0) {
            description = '无酒精，适合所有人饮用';
            color = '#4CAF50'; // 绿色
            cocktailAnimation.classList.add('abv-low');
        } else if (calculatedAbv < 5) {
            description = '低度酒精，适合大多数人饮用';
            color = '#8BC34A'; // 淡绿色
            cocktailAnimation.classList.add('abv-low');
        } else if (calculatedAbv < 15) {
            description = '中等酒精度，相当于啤酒或葡萄酒';
            color = '#FFC107'; // 黄色
            cocktailAnimation.classList.add('abv-medium');
        } else if (calculatedAbv < 25) {
            description = '中高酒精度，适量饮用';
            color = '#FF9800'; // 橙色
            cocktailAnimation.classList.add('abv-medium');
        } else if (calculatedAbv < 40) {
            description = '高酒精度，请小心饮用';
            color = '#FF5722'; // 深橙色
            cocktailAnimation.classList.add('abv-high');
        } else {
            description = '极高酒精度，仅限有经验的人少量饮用';
            color = '#F44336'; // 红色
            cocktailAnimation.classList.add('abv-high');
        }

        abvDescriptionElement.textContent = description;
        calculatedAbvElement.style.color = color;

        // 触发自定义事件，通知ABV更新
        const event = new CustomEvent('abv-updated', { detail: { abv: calculatedAbv } });
        document.dispatchEvent(event);
    }

    // 使updateAbvCalculation在全局作用域可见，以便其他脚本可以扩展它
    window.updateAbvCalculation = updateAbvCalculation;

    // 重置ABV类
    function resetAbvClasses(element) {
        if (element) {
            element.classList.remove('abv-low', 'abv-medium', 'abv-high');
        }
    }

    // 添加制作步骤
    function addPreparationStep() {
        const stepsContainer = document.getElementById('steps-container');
        const stepItems = stepsContainer.querySelectorAll('.step-item');
        const newStepNumber = stepItems.length + 1;

        const newStep = document.createElement('div');
        newStep.className = 'step-item';
        newStep.dataset.step = newStepNumber;

        newStep.innerHTML = `
            <div class="step-number">${newStepNumber}</div>
            <input type="text" class="step-input" placeholder="添加制作鸡尾酒的步骤说明">
            <button class="remove-step-btn" title="删除此步骤">×</button>
        `;

        stepsContainer.appendChild(newStep);
    }

    // 重新编号步骤
    function renumberSteps() {
        const stepItems = document.querySelectorAll('.step-item');
        stepItems.forEach((item, index) => {
            const number = index + 1;
            item.dataset.step = number;
            item.querySelector('.step-number').textContent = number;
        });
    }

    // 保存自定义鸡尾酒
    async function saveCustomCocktail() {
        // 获取鸡尾酒基本信息
        const name = document.getElementById('cocktail-name').value.trim();
        const description = document.getElementById('cocktail-description').value.trim();

        // 验证名称
        if (!name) {
            showErrorMessage('请输入鸡尾酒名称');
            return;
        }

        // 验证是否有选择原料
        if (selectedIngredients.length === 0) {
            showErrorMessage('请至少选择一种原料');
            return;
        }

        // 获取所有步骤输入
        const stepInputs = document.querySelectorAll('.step-input');
        const steps = Array.from(stepInputs).map(input => input.value.trim()).filter(step => step);

        // 验证是否有至少一个步骤
        if (steps.length === 0) {
            showErrorMessage('请至少添加一个制作步骤');
            return;
        }

        // 计算预估的酒精含量
        let totalVolume = 0;
        let totalAlcoholVolume = 0;

        selectedIngredients.forEach(ingredient => {
            const volume = ingredient.volume || 0;
            const abv = ingredient.abv || 0;

            totalVolume += volume;
            totalAlcoholVolume += (volume * abv / 100);
        });

        const estimatedAbv = totalVolume > 0 ? (totalAlcoholVolume / totalVolume) * 100 : 0;
        const roundedAbv = Math.round(estimatedAbv * 10) / 10;

        // 准备发送的数据
        const cocktailData = {
            name: name,
            description: description,
            ingredients: selectedIngredients.map(ingredient => ({
                id: ingredient.id,
                name: ingredient.name,
                volume: ingredient.volume,
                abv: ingredient.abv,
                category: ingredient.category
            })),
            steps: steps,
            estimatedAbv: roundedAbv
        };

        try {
            // 检查用户是否已登录
            const authStatusResponse = await fetch('/api/auth/status');
            const authStatus = await authStatusResponse.json();

            if (!authStatus.loggedIn) {
                // 如果没有登录，显示提示并跳转到登录页面
                showErrorMessage('请先登录后再保存鸡尾酒配方');

                // 保存当前表单数据到sessionStorage（可选）
                sessionStorage.setItem('pendingCocktail', JSON.stringify(cocktailData));

                setTimeout(() => {
                    window.location.href = '/auth/login/';
                }, 1500);

                return;
            }

            // 用户已登录，发送请求创建鸡尾酒
            const response = await fetch('/api/custom/cocktails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cocktailData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '创建鸡尾酒失败');
            }

            const result = await response.json();

            // 显示成功信息并返回首页
            alert('鸡尾酒创建成功！');
            window.location.href = '/recipes/';

        } catch (error) {
            console.error('保存鸡尾酒时出错:', error);
            showErrorMessage(error.message || '创建鸡尾酒失败，请稍后重试');
        }
    }

    // 显示错误消息
    function showErrorMessage(message) {
        console.error('错误:', message);

        // 使用更友好的对话框而不是简单的alert
        const dialogBox = document.createElement('div');
        dialogBox.className = 'custom-dialog error-dialog';

        dialogBox.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>操作错误</h3>
                </div>
                <div class="dialog-body">
                    <p>${message}</p>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-close-btn">确定</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialogBox);

        // 添加关闭按钮事件
        const closeBtn = dialogBox.querySelector('.dialog-close-btn');
        closeBtn.addEventListener('click', function () {
            document.body.removeChild(dialogBox);
        });

        // 5秒后自动关闭
        setTimeout(() => {
            if (document.body.contains(dialogBox)) {
                document.body.removeChild(dialogBox);
            }
        }, 5000);
    }

    // 启动
    initialize();
}); 