// 自定义鸡尾酒创建器的JavaScript逻辑
document.addEventListener('DOMContentLoaded', function () {
    // --- 1. 全局变量 & 编辑模式检测 ---
    let allIngredients = {}; 
    let selectedIngredients = []; 
    let currentCategoryTab = 'base_alcohol'; 

    // [核心] 检查 URL 是否包含 ?id=xxx
    const urlParams = new URLSearchParams(window.location.search);
    const editRecipeId = urlParams.get('id'); 
    const isEditMode = !!editRecipeId; // 转换为布尔值 (true/false)

    // 分类配置
    const CATEGORY_ORDER = ['base_alcohol', 'liqueurs', 'vermouth_wine', 'bitters', 'juice', 'syrup', 'soda_mixer', 'dairy_cream', 'other'];
    const CATEGORY_NAMES = {
        'base_alcohol': '基酒', 'liqueurs': '力娇酒/利口酒', 'vermouth_wine': '味美思/加强葡萄酒',
        'bitters': '苦精', 'juice': '果汁', 'syrup': '糖浆',
        'soda_mixer': '碳酸/调配饮料', 'dairy_cream': '奶制品', 'other': '其他'
    };

    // --- 2. 初始化函数 ---
    async function initialize() {
        try {
            console.log(isEditMode ? `进入修改模式 (ID: ${editRecipeId})` : '进入创建模式');

            // 2.1 如果是编辑模式，修改界面标题
            if (isEditMode) {
                const titleEl = document.querySelector('h2');
                if (titleEl) titleEl.textContent = '修改配方';
                const saveBtn = document.getElementById('create-cocktail-btn');
                if (saveBtn) saveBtn.textContent = '保存修改';
            }

            // 2.2 获取原料库 (必须先有原料库，才能做回显匹配)
            const response = await fetch('/api/custom/ingredients');
            if (!response.ok) throw new Error('原料数据加载失败');
            const responseText = await response.text();
            allIngredients = JSON.parse(responseText);

            // 2.3 初始化基础界面
            loadIngredientsForCategory('base_alcohol');
            renderCategoryTabs();
            setupEventListeners();
            updateAbvCalculation();

            // 2.4 [关键] 如果是编辑模式，去后台拉取旧数据并填入
            if (isEditMode) {
                await loadRecipeForEdit(editRecipeId);
            }

        } catch (error) {
            console.error('初始化错误:', error);
            showErrorMessage('加载失败: ' + error.message);
        }
    }

    // --- 3. [新增] 加载并回显旧数据 ---
    async function loadRecipeForEdit(id) {
        try {
            const res = await fetch(`/api/recipes/${id}`);
            if (!res.ok) throw new Error('无法获取原配方数据');
            const recipe = await res.json();

            // >>> 回显名称 <<<
            const nameInput = document.getElementById('cocktail-name');
            if (nameInput) nameInput.value = recipe.name;
            const descInput = document.getElementById('cocktail-description');
            if (descInput) descInput.value = recipe.description || '';

            // >>> 回显步骤 <<<
            const stepsContainer = document.getElementById('steps-container');
            if (stepsContainer) {
                stepsContainer.innerHTML = ''; // 清空默认空行
                
                let steps = [];
                // 兼容性处理：步骤可能是数组，也可能是字符串
                if (Array.isArray(recipe.instructions)) {
                    steps = recipe.instructions;
                } else if (typeof recipe.instructions === 'string') {
                    steps = recipe.instructions.split('\n');
                }

                if (steps.length > 0) {
                    steps.forEach(stepText => addPreparationStep(stepText));
                } else {
                    addPreparationStep();
                }
            }

            // >>> 回显原料 (最关键部分) <<<
            if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
                selectedIngredients = []; // 先清空

                recipe.ingredients.forEach(savedIng => {
                    let matchedItem = null;
                    let matchedCategory = 'other';

                    // 尝试在原料库中找到匹配项 (忽略大小写)
                    if (allIngredients.ingredients) {
                        for (const cat of allIngredients.ingredients) {
                            const found = cat.items.find(item => 
                                item.name.toLowerCase() === savedIng.name.toLowerCase()
                            );
                            if (found) {
                                matchedItem = found;
                                matchedCategory = cat.category;
                                break;
                            }
                        }
                    }

                    // [强力回显] 即使原料库里找不到(比如是旧数据)，也强行显示，防止数据丢失
                    selectedIngredients.push({
                        id: matchedItem ? matchedItem.id : ('legacy_' + Math.random().toString(36).substr(2, 9)),
                        name: savedIng.name,
                        volume: parseFloat(savedIng.volume) || 30,
                        abv: parseFloat(savedIng.abv) || 0,
                        category: matchedCategory,
                        unit: matchedItem ? matchedItem.unit : 'ml'
                    });
                });

                // 渲染回显结果
                renderSelectedIngredients();
                updateAbvCalculation();
                
                // 高亮左侧列表 (如果匹配到了)
                highlightSelectedItemsInList();
            }

            // >>> 回显图片提示 <<<
            if (recipe.image) {
                const imgLabel = document.querySelector('label[for="cocktail-image"]');
                if (imgLabel) {
                    imgLabel.innerHTML = `当前已有封面图 (不上传则保留原图) <span style="color:#00f2fe">✔</span>`;
                }
            }

        } catch (error) {
            console.error('回显失败:', error);
            showErrorMessage('无法加载旧数据，请刷新重试');
        }
    }

    // --- 4. 保存/更新逻辑 ---
    async function saveCustomCocktail() {
        const nameInput = document.getElementById('cocktail-name');
        const descInput = document.getElementById('cocktail-description');
        const imageInput = document.getElementById('cocktail-image');
        
        const name = nameInput ? nameInput.value.trim() : '';
        const description = descInput ? descInput.value.trim() : '';
        
        if (!name) return showErrorMessage('请输入鸡尾酒名称');
        if (selectedIngredients.length === 0) return showErrorMessage('请至少选择一种原料');

        // 收集步骤
        const stepInputs = document.querySelectorAll('.step-input');
        const steps = Array.from(stepInputs).map(input => input.value.trim()).filter(step => step);

        // 计算ABV
        let totalVol = 0, totalAlc = 0;
        selectedIngredients.forEach(i => {
            totalVol += (i.volume || 0);
            totalAlc += (i.volume || 0) * (i.abv || 0) / 100;
        });
        const estimatedAbv = totalVol > 0 ? Math.round((totalAlc / totalVol) * 1000) / 10 : 0;

        // 构建 FormData
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('estimatedAbv', estimatedAbv);
        
        // 序列化原料 (只传必要字段)
        const ingredientsData = selectedIngredients.map(ing => ({
            name: ing.name,
            volume: ing.volume,
            abv: ing.abv
        }));
        formData.append('ingredients', JSON.stringify(ingredientsData));
        formData.append('steps', JSON.stringify(steps));

        // 图片处理
        if (imageInput && imageInput.files[0]) {
            formData.append('image', imageInput.files[0]);
        }

        try {
            // [智能判断] 是更新还是新建？
            const url = isEditMode ? `/api/custom/cocktails/${editRecipeId}` : '/api/custom/cocktails';
            const method = isEditMode ? 'PUT' : 'POST';

            console.log(`正在提交... URL: ${url}, Method: ${method}`);
            console.log('提交数据:', {
                name,
                description,
                estimatedAbv,
                ingredients: ingredientsData,
                steps
            });

            const response = await fetch(url, {
                method: method,
                body: formData
            });

            if (!response.ok) {
                let errorMessage = '操作失败';
                try {
                    const err = await response.json();
                    errorMessage = err.message || errorMessage;
                    
                    // 如果是401未授权错误，提示登录
                    if (response.status === 401) {
                        showErrorMessage('您尚未登录，请先登录');
                        setTimeout(() => {
                            window.location.href = '/auth/login/';
                        }, 1500);
                        return;
                    }
                } catch (e) {
                    errorMessage = `服务器错误 (${response.status})`;
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('保存成功:', result);
            
            alert(isEditMode ? '修改成功！' : '创建成功！');
            window.location.href = '/profile/'; // 完成后返回个人中心

        } catch (error) {
            console.error('保存失败:', error);
            showErrorMessage('保存失败: ' + error.message);
        }
    }

    // --- 5. 辅助功能函数 ---

    // 渲染分类标签
    function renderCategoryTabs() {
        const container = document.getElementById('ingredient-categories');
        if (!container) return;
        container.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = 'category-tab';
        allBtn.dataset.category = 'all';
        allBtn.textContent = '全部';
        container.appendChild(allBtn);

        CATEGORY_ORDER.forEach(catKey => {
            // 只渲染存在的分类
            const hasCat = allIngredients.ingredients && allIngredients.ingredients.some(c => c.category === catKey);
            if (hasCat) {
                const btn = document.createElement('button');
                btn.className = 'category-tab';
                btn.dataset.category = catKey;
                btn.textContent = CATEGORY_NAMES[catKey] || catKey;
                container.appendChild(btn);
            }
        });
        updateTabStyles();
    }

    // 加载对应分类原料
    function loadIngredientsForCategory(category) {
        const list = document.getElementById('ingredients-list');
        if(!list) return;
        list.innerHTML = '';
        
        let itemsToShow = [];
        if (category === 'all') {
            if(allIngredients.ingredients) {
                allIngredients.ingredients.forEach(c => {
                    if(c.items) itemsToShow.push(...c.items.map(i => ({...i, _cat: c.category})));
                });
            }
        } else if (allIngredients.ingredients) {
            const catObj = allIngredients.ingredients.find(c => c.category === category);
            if(catObj) itemsToShow = catObj.items;
        }

        if (itemsToShow.length === 0) {
            list.innerHTML = '<div class="no-ingredients-message">该分类暂无原料</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'ingredients-grid';

        itemsToShow.forEach(ing => {
            const item = document.createElement('div');
            item.className = 'ingredient-item';
            item.dataset.id = ing.id;
            
            // 检查是否已选，如果是，加高亮
            if (selectedIngredients.some(s => s.id === ing.id)) {
                item.classList.add('selected');
            }

            // 颜色逻辑
            const catKey = ing._cat || category;
            const colors = {'base_alcohol':'#FF9800', 'liqueurs':'#FF5722', 'juice':'#4CAF50', 'syrup':'#E91E63', 'other':'#607D8B'};
            const bg = colors[catKey] || '#607D8B';

            item.innerHTML = `
                <div class="ingredient-card">
                    <div class="ingredient-icon" style="background-color:${bg}">${ing.name.charAt(0)}</div>
                    <div class="ingredient-details">
                        <div class="ingredient-name">${ing.name}</div>
                        <div class="ingredient-abv">${ing.abv > 0 ? ing.abv + '%' : (ing.unit||'ml')}</div>
                    </div>
                    <button class="add-ingredient-btn">+</button>
                </div>
            `;
            grid.appendChild(item);
        });
        list.appendChild(grid);
        currentCategoryTab = category;
        updateTabStyles();
    }

    function setupEventListeners() {
        // 阻止表单默认提交行为
        const form = document.getElementById('custom-cocktail-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('表单提交被阻止');
                return false;
            });
        }
        
        // 分类点击
        document.getElementById('ingredient-categories')?.addEventListener('click', e => {
            const tab = e.target.closest('.category-tab');
            if (tab) loadIngredientsForCategory(tab.dataset.category);
        });
        // 添加原料 (+)
        document.getElementById('ingredients-list')?.addEventListener('click', e => {
            const btn = e.target.closest('.add-ingredient-btn');
            if (btn) addIngredientToSelection(btn.closest('.ingredient-item').dataset.id);
        });
        // 添加步骤 (支持传参)
        document.getElementById('add-step-btn')?.addEventListener('click', () => addPreparationStep());
        // 删除步骤
        document.getElementById('steps-container')?.addEventListener('click', e => {
            if (e.target.classList.contains('remove-step-btn')) {
                e.target.closest('.step-item').remove();
                renumberSteps();
            }
        });
        // 保存/创建按钮
        document.getElementById('create-cocktail-btn')?.addEventListener('click', saveCustomCocktail);
        // 取消
        document.getElementById('cancel-btn')?.addEventListener('click', () => {
            if(confirm('确定要离开吗？未保存的内容将丢失。')) window.location.href = '/profile/';
        });
        // 右侧已选列表：删除和修改体积
        const selList = document.getElementById('selected-ingredients-list');
        if (selList) {
            selList.addEventListener('click', e => {
                const btn = e.target.closest('.remove-selected-btn');
                if (btn) removeIngredientFromSelection(btn.closest('.selected-ingredient-item').dataset.id);
            });
            selList.addEventListener('input', e => {
                if (e.target.classList.contains('volume-input')) {
                    const id = e.target.closest('.selected-ingredient-item').dataset.id;
                    const idx = selectedIngredients.findIndex(i => i.id == id);
                    if (idx !== -1) {
                        selectedIngredients[idx].volume = parseFloat(e.target.value) || 0;
                        updateAbvCalculation();
                    }
                }
            });
        }
        // 搜索
        document.getElementById('ingredient-search')?.addEventListener('input', function() {
            const v = this.value.toLowerCase();
            document.querySelectorAll('.ingredient-item').forEach(i => {
                const n = i.querySelector('.ingredient-name').textContent.toLowerCase();
                i.style.display = n.includes(v) ? '' : 'none';
            });
        });
        
        // 监听鸡尾酒名称输入，更新AI分析按钮状态
        document.getElementById('cocktail-name')?.addEventListener('input', updateAnalyzeButtonState);

        // AI生成配方按钮
        document.getElementById('ai-generate-btn')?.addEventListener('click', generateAIRecipe);
        
        // 重新生成按钮
        document.getElementById('regenerate-btn')?.addEventListener('click', generateAIRecipe);
        
        // 应用配方按钮
        document.getElementById('apply-recipe-btn')?.addEventListener('click', applyAIRecipe);
        
        // AI口味分析按钮
        document.getElementById('ai-analyze-btn')?.addEventListener('click', analyzeFlavorProfile);
    }

    // 添加原料逻辑
    function addIngredientToSelection(id) {
        if (selectedIngredients.some(i => i.id == id)) return showErrorMessage('已添加该原料');
        
        let item = null;
        let cat = 'other';
        // 在所有分类里找这个ID
        if(allIngredients.ingredients) {
            for(const c of allIngredients.ingredients) {
                const f = c.items.find(i => i.id == id);
                if(f) { item = f; cat = c.category; break; }
            }
        }
        if (!item) return;

        selectedIngredients.push({
            id: item.id,
            name: item.name,
            volume: 30,
            abv: item.abv,
            category: cat,
            unit: item.unit
        });
        renderSelectedIngredients();
        updateAbvCalculation();
        
        // 高亮左侧
        const el = document.querySelector(`.ingredient-item[data-id="${id}"]`);
        if(el) el.classList.add('selected');
    }

    function removeIngredientFromSelection(id) {
        selectedIngredients = selectedIngredients.filter(i => i.id != id);
        renderSelectedIngredients();
        updateAbvCalculation();
        const el = document.querySelector(`.ingredient-item[data-id="${id}"]`);
        if(el) el.classList.remove('selected');
    }

    function renderSelectedIngredients() {
        const list = document.getElementById('selected-ingredients-list');
        const count = document.getElementById('selected-count');
        if(!list) return;
        
        count.textContent = selectedIngredients.length;
        list.innerHTML = '';
        
        if (selectedIngredients.length === 0) {
            list.innerHTML = '<div class="empty-selection-message">请选择原料</div>';
            updateAnalyzeButtonState();
            return;
        }

        // 简单分组渲染逻辑 (为了代码简洁，这里不按分类分组了，直接列出)
        // 如果您希望按分类分组，可以参考之前的逻辑，或者直接平铺显示
        selectedIngredients.forEach(ing => {
            const div = document.createElement('div');
            div.className = 'selected-ingredient-item';
            div.dataset.id = ing.id;
            div.innerHTML = `
                <div class="selected-ingredient-name">${ing.name}</div>
                <div class="selected-ingredient-volume">
                    <input type="number" class="volume-input" value="${ing.volume}" min="0" step="5">
                    <span class="volume-unit">${ing.unit||'ml'}</span>
                </div>
                <button class="remove-selected-btn">×</button>
            `;
            list.appendChild(div);
        });
        
        updateAnalyzeButtonState();
    }

    // 更新AI分析按钮和创建按钮的可用状态
    function updateAnalyzeButtonState() {
        const analyzeBtn = document.getElementById('ai-analyze-btn');
        const createBtn = document.getElementById('create-cocktail-btn');
        const nameInput = document.getElementById('cocktail-name');
        
        const hasIngredients = selectedIngredients.length > 0;
        const hasName = nameInput && nameInput.value.trim().length > 0;
        
        if (analyzeBtn) {
            analyzeBtn.disabled = !(hasIngredients && hasName);
        }
        
        // 创建按钮需要名称和至少一个原料
        if (createBtn) {
            createBtn.disabled = !(hasIngredients && hasName);
        }
    }

    // [新增] 辅助高亮函数
    function highlightSelectedItemsInList() {
        const currentItems = document.querySelectorAll('.ingredient-item');
        currentItems.forEach(item => {
            if (selectedIngredients.some(sel => sel.id === item.dataset.id)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // [修改] 添加步骤 (支持默认值)
    function addPreparationStep(defaultValue = '') {
        const stepsContainer = document.getElementById('steps-container');
        if (!stepsContainer) return;
        
        const stepItems = stepsContainer.querySelectorAll('.step-item');
        const newStepNumber = stepItems.length + 1;

        const newStep = document.createElement('div');
        newStep.className = 'step-item';
        newStep.dataset.step = newStepNumber;

        newStep.innerHTML = `
            <div class="step-number">${newStepNumber}</div>
            <input type="text" class="step-input" placeholder="输入步骤说明" value="${defaultValue}">
            <button class="remove-step-btn" title="删除">×</button>
        `;
        stepsContainer.appendChild(newStep);
    }

    function updateAbvCalculation() {
        const abvEl = document.getElementById('calculated-abv');
        const descEl = document.getElementById('abv-description');
        const anim = document.querySelector('.cocktail-glass');
        if(!abvEl) return;

        let totalVol = 0, totalAlc = 0;
        selectedIngredients.forEach(i => {
            totalVol += i.volume;
            totalAlc += i.volume * (i.abv||0) / 100;
        });
        
        const abv = totalVol > 0 ? (totalAlc/totalVol)*100 : 0;
        abvEl.textContent = abv.toFixed(1) + '%';
        
        let desc = '无酒精';
        if (anim) anim.className = 'cocktail-glass'; 
        if (abv > 0 && abv < 10) { desc = '低度微醺'; if(anim) anim.classList.add('abv-low'); }
        else if (abv >= 10 && abv < 30) { desc = '中等烈度'; if(anim) anim.classList.add('abv-medium'); }
        else if (abv >= 30) { desc = '高烈度'; if(anim) anim.classList.add('abv-high'); }
        
        if(descEl) descEl.textContent = desc;
        abvEl.style.color = abv > 20 ? '#FF5722' : '#4CAF50';
    }

    function renumberSteps() {
        document.querySelectorAll('.step-item').forEach((item, idx) => {
            item.querySelector('.step-number').textContent = idx + 1;
        });
    }

    function updateTabStyles() {
        document.querySelectorAll('.category-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.category === currentCategoryTab);
        });
    }

    function showErrorMessage(msg) {
        alert(msg); 
    }

    // AI 生成配方功能
    async function generateAIRecipe() {
        const tasteInput = document.getElementById('taste-description');
        const occasionSelect = document.getElementById('occasion-select');
        const strengthSelect = document.getElementById('strength-select');
        const generateBtn = document.getElementById('ai-generate-btn');
        const spinner = generateBtn?.querySelector('.loading-spinner');
        const btnText = generateBtn?.querySelector('.btn-text');

        const tasteDescription = tasteInput?.value.trim();
        if (!tasteDescription) {
            showErrorMessage('请输入口味描述');
            return;
        }

        try {
            // 显示加载状态
            if (generateBtn) generateBtn.disabled = true;
            if (spinner) spinner.style.display = 'inline-block';
            if (btnText) btnText.textContent = '生成中...';

            const response = await fetch('/api/custom/generate-recipe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tasteDescription: tasteDescription,
                    occasion: occasionSelect?.value || '',
                    alcoholStrength: strengthSelect?.value || ''
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'AI生成失败');
            }

            const result = await response.json();
            displayAIRecipe(result.recipe);

        } catch (error) {
            console.error('AI生成配方错误:', error);
            showErrorMessage(error.message || '生成失败，请稍后再试');
        } finally {
            // 恢复按钮状态
            if (generateBtn) generateBtn.disabled = false;
            if (spinner) spinner.style.display = 'none';
            if (btnText) btnText.textContent = '生成AI配方';
        }
    }

    // 显示 AI 生成的配方
    let currentAIRecipe = null; // 保存当前AI生成的配方数据
    
    function displayAIRecipe(recipe) {
        const resultSection = document.getElementById('ai-recipe-result');
        if (!resultSection) return;

        // 保存配方数据供后续使用
        currentAIRecipe = recipe;

        // 填充配方名称和描述
        const nameEl = document.getElementById('generated-recipe-name');
        const descEl = document.getElementById('generated-recipe-description');
        if (nameEl) nameEl.textContent = recipe.name || 'AI推荐配方';
        if (descEl) descEl.textContent = recipe.description || '';

        // 填充原料列表
        const ingredientsEl = document.getElementById('generated-ingredients');
        if (ingredientsEl && recipe.ingredients) {
            ingredientsEl.innerHTML = recipe.ingredients.map(ing => `
                <div class="ingredient-row">
                    <span class="ingredient-name">${ing.name}</span>
                    <span class="ingredient-amount">${ing.volume || ing.amount || '适量'}${ing.volume ? 'ml' : ''}</span>
                </div>
            `).join('');
        }

        // 填充制作步骤
        const stepsEl = document.getElementById('generated-steps');
        if (stepsEl && recipe.steps) {
            stepsEl.innerHTML = recipe.steps.map(step => `<li>${step}</li>`).join('');
        }

        // 填充口味特征
        const tasteProfileEl = document.getElementById('taste-profile');
        if (tasteProfileEl && recipe.taste_profile) {
            const profile = recipe.taste_profile;
            tasteProfileEl.innerHTML = `
                <div class="taste-bar">
                    <span>甜度:</span>
                    <div class="bar"><div class="fill" style="width: ${(profile.sweetness || 0) * 20}%"></div></div>
                    <span>${profile.sweetness || 0}/5</span>
                </div>
                <div class="taste-bar">
                    <span>酸度:</span>
                    <div class="bar"><div class="fill" style="width: ${(profile.sourness || 0) * 20}%"></div></div>
                    <span>${profile.sourness || 0}/5</span>
                </div>
                <div class="taste-bar">
                    <span>苦度:</span>
                    <div class="bar"><div class="fill" style="width: ${(profile.bitterness || 0) * 20}%"></div></div>
                    <span>${profile.bitterness || 0}/5</span>
                </div>
                <div class="taste-bar">
                    <span>烈度:</span>
                    <div class="bar"><div class="fill" style="width: ${(profile.strength || 0) * 20}%"></div></div>
                    <span>${profile.strength || 0}/5</span>
                </div>
            `;
        }

        // 填充小贴士
        const tipsEl = document.getElementById('recipe-tips');
        if (tipsEl) {
            tipsEl.innerHTML = `<p>${recipe.tips || '暂无提示'}</p>`;
        }

        // 显示结果区域
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 应用 AI 配方到表单
    function applyAIRecipe() {
        if (!currentAIRecipe) {
            showErrorMessage('没有可用的AI配方');
            return;
        }

        const nameEl = document.getElementById('generated-recipe-name');
        const descEl = document.getElementById('generated-recipe-description');
        const stepsEl = document.getElementById('generated-steps');

        // 应用名称
        const nameInput = document.getElementById('cocktail-name');
        if (nameInput && nameEl) {
            nameInput.value = nameEl.textContent;
        }

        // 应用描述
        const descInput = document.getElementById('cocktail-description');
        if (descInput && descEl) {
            descInput.value = descEl.textContent;
        }

        // 清空并重新添加原料
        selectedIngredients = [];
        if (currentAIRecipe.ingredients && Array.isArray(currentAIRecipe.ingredients)) {
            currentAIRecipe.ingredients.forEach((aiIng, index) => {
                // 尝试在原料库中查找匹配的原料
                let matchedItem = null;
                let matchedCategory = 'other';
                
                if (allIngredients.ingredients) {
                    for (const cat of allIngredients.ingredients) {
                        const found = cat.items.find(item => 
                            item.name.toLowerCase().includes(aiIng.name.toLowerCase()) ||
                            aiIng.name.toLowerCase().includes(item.name.toLowerCase())
                        );
                        if (found) {
                            matchedItem = found;
                            matchedCategory = cat.category;
                            break;
                        }
                    }
                }

                // 如果找到匹配的原料，使用原料库的数据；否则创建新的
                if (matchedItem) {
                    selectedIngredients.push({
                        id: matchedItem.id,
                        name: matchedItem.name,
                        volume: aiIng.volume || 30,
                        abv: matchedItem.abv || aiIng.abv || 0,
                        category: matchedCategory,
                        unit: matchedItem.unit || 'ml'
                    });
                } else {
                    // 创建临时原料（不在原料库中的）
                    selectedIngredients.push({
                        id: `temp-${Date.now()}-${index}`,
                        name: aiIng.name,
                        volume: aiIng.volume || 30,
                        abv: aiIng.abv || 0,
                        category: aiIng.category || 'other',
                        unit: 'ml'
                    });
                }
            });
        }

        // 渲染已选原料列表
        renderSelectedIngredients();
        updateAbvCalculation();
        highlightSelectedItemsInList();

        // 应用步骤
        const stepsContainer = document.getElementById('steps-container');
        if (stepsContainer && stepsEl) {
            stepsContainer.innerHTML = '';
            const stepItems = stepsEl.querySelectorAll('li');
            stepItems.forEach(li => {
                addPreparationStep(li.textContent);
            });
        }

        // 提示用户
        alert('✅ AI配方已应用到下方表单！\n\n包括：\n- 配方名称和描述\n- 原料及用量\n- 制作步骤\n\n请检查并调整后保存。');
        
        // 滚动到表单区域
        document.querySelector('h2')?.scrollIntoView({ behavior: 'smooth' });
    }

    // AI 口味分析功能
    async function analyzeFlavorProfile() {
        const nameInput = document.getElementById('cocktail-name');
        const descInput = document.getElementById('cocktail-description');
        const analyzeBtn = document.getElementById('ai-analyze-btn');
        const spinner = analyzeBtn?.querySelector('.loading-spinner');
        const btnText = analyzeBtn?.querySelector('.btn-text');
        const resultDiv = document.getElementById('ai-analysis-result');
        const contentDiv = document.getElementById('analysis-content');

        const name = nameInput?.value.trim() || '未命名配方';
        const description = descInput?.value.trim() || '';

        if (selectedIngredients.length === 0) {
            showErrorMessage('请先选择原料');
            return;
        }

        // 收集步骤
        const stepInputs = document.querySelectorAll('.step-input');
        const steps = Array.from(stepInputs)
            .map(input => input.value.trim())
            .filter(step => step.length > 0);

        try {
            // 显示加载状态
            if (analyzeBtn) analyzeBtn.disabled = true;
            if (spinner) spinner.style.display = 'inline-block';
            if (btnText) btnText.textContent = '分析中...';

            const response = await fetch('/api/custom/analyze-flavor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description,
                    ingredients: selectedIngredients.map(ing => ({
                        name: ing.name,
                        volume: ing.volume,
                        abv: ing.abv
                    })),
                    steps: steps
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'AI分析失败');
            }

            const result = await response.json();
            
            // 显示分析结果
            if (contentDiv && result.analysis) {
                // 将换行符转换为 <br> 或使用 <pre> 标签保持格式
                contentDiv.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${result.analysis}</pre>`;
            }

            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

        } catch (error) {
            console.error('AI口味分析错误:', error);
            showErrorMessage(error.message || '分析失败，请稍后再试');
        } finally {
            // 恢复按钮状态
            if (analyzeBtn) analyzeBtn.disabled = false;
            if (spinner) spinner.style.display = 'none';
            if (btnText) btnText.textContent = '分析口味特征';
        }
    }

    // 启动
    initialize();
});