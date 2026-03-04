// 自定义鸡尾酒创建器的JavaScript逻辑
document.addEventListener('DOMContentLoaded', function () {
    // --- 1. 全局变量 & 编辑模式检测 ---
    let allIngredients = {}; 
    let selectedIngredients = []; 
    let currentCategoryTab = 'base_alcohol';
    let originalImagePath = null; // 保存原图片路径 
    let lastGeneratePayload = null;
    let generatedRecipe = null;
    let lastAnalysisAt = null;

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
    const TRASH_ICON_SVG = `
        <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24">
            <path d="M5 7h14M9 7V5h6v2M9 10v7M12 10v7M15 10v7M7 7l1 12h8l1-12"
                fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    `;

    // --- 2. 初始化函数 ---
    async function initialize() {
        try {
            console.log(isEditMode ? `进入修改模式 (ID: ${editRecipeId})` : '进入创建模式');

            // 2.1 如果是编辑模式，修改界面标题
            if (isEditMode) {
                const titleEl = document.getElementById('custom-form-title');
                if (titleEl) titleEl.textContent = '修改配方';
                const saveBtn = document.getElementById('save-cocktail-btn');
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
            setupAiCollapsible();
            updateAbvCalculation();
            updateSubmitState(); // Call updateSubmitState after initializing

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
                updateSubmitState(); // Call updateSubmitState after loading edit recipe
                
                // 高亮左侧列表 (如果匹配到了)
                highlightSelectedItemsInList();
            }

            // >>> 回显图片提示 <<<
            if (recipe.image) {
                originalImagePath = recipe.image; // 保存原图片路径
                showImagePreview(recipe.image); // 显示图片预览
            }

        } catch (error) {
            console.error('回显失败:', error);
            showErrorMessage('无法加载旧数据，请刷新重试');
        }
    }

    // --- 4. 保存/更新逻辑 ---
    async function saveCustomCocktail() {
        const nameInput = document.getElementById('cocktail-name');
        const imageInput = document.getElementById('cocktail-image');
        
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) return showErrorMessage('请输入鸡尾酒名称');
        if (selectedIngredients.length === 0) return showErrorMessage('请至少选择一种原料');

        // 收集步骤（只从 steps-container 里收集，不包括输入框）
        const stepsContainer = document.getElementById('steps-container');
        const stepInputs = stepsContainer ? stepsContainer.querySelectorAll('.step-input') : [];
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
        
        // 添加描述
        const descInput = document.getElementById('cocktail-description');
        if (descInput) {
            formData.append('description', descInput.value.trim());
        }
        
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
        } else if (isEditMode && originalImagePath) {
            // 编辑模式下，如果没有上传新图但有原图，告诉后端保留原图
            formData.append('keepOriginalImage', 'true');
        }

        try {
            // [智能判断] 是更新还是新建？
            // 鸿蒙前端使用 POST 方法（PUT 可能有兼容性问题）
            const url = isEditMode ? `/api/custom/cocktails/${editRecipeId}/update` : '/api/custom/cocktails';
            const method = 'POST'; // 统一使用 POST

            console.log(`正在提交... URL: ${url}, Method: ${method}`);

            const response = await fetch(url, {
                method: method,
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || '操作失败');
            }

            showSuccessMessage(isEditMode ? '修改成功，正在返回个人中心...' : '创建成功，正在返回个人中心...');
            setTimeout(() => {
                window.location.href = '/profile/';
            }, 900); // 完成后返回个人中心

        } catch (error) {
            console.error('保存失败:', error);
            showErrorMessage(error.message);
        }
    }

    // --- 5. 辅助功能函数 ---

    // 渲染分类标签
    function renderCategoryTabs() {
        const container = document.getElementById('ingredient-categories');
        if (!container) return;
        container.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'category-tab';
        allBtn.dataset.category = 'all';
        allBtn.textContent = '全部';
        container.appendChild(allBtn);

        CATEGORY_ORDER.forEach(catKey => {
            // 只渲染存在的分类
            const hasCat = allIngredients.ingredients && allIngredients.ingredients.some(c => c.category === catKey);
            if (hasCat) {
                const btn = document.createElement('button');
                btn.type = 'button';
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

            const catKey = ing._cat || category;

            item.innerHTML = `
                <div class="ingredient-card">
                    <div class="ingredient-icon" data-category="${catKey}">${ing.name.charAt(0)}</div>
                    <div class="ingredient-details">
                        <div class="ingredient-name">${ing.name}</div>
                        <div class="ingredient-abv">${ing.abv > 0 ? ing.abv + '%' : (ing.unit||'ml')}</div>
                    </div>
                    <button type="button" class="add-ingredient-btn">+</button>
                </div>
            `;
            grid.appendChild(item);
        });
        list.appendChild(grid);
        currentCategoryTab = category;
        updateTabStyles();
    }

    function setupEventListeners() {
        // 分类点击
        document.getElementById('ingredient-categories')?.addEventListener('click', e => {
            const tab = e.target.closest('.category-tab');
            if (tab) {
                e.preventDefault();
                loadIngredientsForCategory(tab.dataset.category);
            }
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
            const removeBtn = e.target.closest('.remove-step-btn');
            if (removeBtn) {
                removeBtn.closest('.step-item').remove();
                renumberSteps();
                updateAiAnalyzeState();
            }
        });
        // 表单提交与按钮点击：统一走 saveCustomCocktail，阻止默认提交刷新
        const form = document.getElementById('custom-cocktail-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                saveCustomCocktail();
            });
        }
        document.getElementById('create-cocktail-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            saveCustomCocktail();
        });
        // 兼容旧的保存按钮 ID（如果存在）
        document.getElementById('save-cocktail-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            saveCustomCocktail();
        });
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

        // 名称输入变更时更新提交按钮状态
        document.getElementById('cocktail-name')?.addEventListener('input', updateSubmitState);
        
        // 图片上传相关事件
        setupImageUpload();

        // AI智能调酒师
        document.getElementById('ai-generate-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            generateAiRecipe();
        });

        document.getElementById('regenerate-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            generateAiRecipe(true);
        });

        document.getElementById('apply-recipe-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            applyGeneratedRecipeToForm();
        });

        document.getElementById('ai-analyze-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            analyzeCurrentRecipeFlavor();
        });

        document.getElementById('cocktail-description')?.addEventListener('input', updateAiAnalyzeState);
        document.getElementById('steps-container')?.addEventListener('input', updateAiAnalyzeState);
    }

    function setupAiCollapsible() {
        const toggleBtn = document.getElementById('ai-toggle-btn');
        const panel = document.getElementById('ai-bartender-panel');
        if (!toggleBtn || !panel) return;

        setAiPanelExpanded(false);
        toggleBtn.addEventListener('click', () => {
            const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            setAiPanelExpanded(!expanded);
        });
    }

    function setAiPanelExpanded(expanded) {
        const toggleBtn = document.getElementById('ai-toggle-btn');
        const panel = document.getElementById('ai-bartender-panel');
        const hintEl = toggleBtn?.querySelector('.toggle-hint');
        if (!toggleBtn || !panel) return;

        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (hintEl) hintEl.textContent = expanded ? '点击收起' : '点击展开';
        panel.hidden = !expanded;
    }

    async function analyzeCurrentRecipeFlavor() {
        if (selectedIngredients.length === 0) {
            return showErrorMessage('请先添加至少一种原料，再进行AI口味分析');
        }

        const payload = buildAnalyzePayload();
        setAiAnalyzeLoading(true);

        try {
            const response = await fetch('/api/custom/analyze-flavor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            let data = null;
            try {
                data = await response.json();
            } catch (_) {
                data = null;
            }

            if (!response.ok) {
                throw new Error(data?.message || 'AI口味分析失败，请稍后重试');
            }

            if (!data || !data.analysis) {
                throw new Error('AI分析结果为空，请重试');
            }

            lastAnalysisAt = data.analyzedAt || new Date().toISOString();
            renderAiAnalysisResult(data.analysis, lastAnalysisAt);
        } catch (error) {
            console.error('AI口味分析失败:', error);
            showErrorMessage(error.message || 'AI口味分析失败，请稍后重试');
        } finally {
            setAiAnalyzeLoading(false);
            updateAiAnalyzeState();
        }
    }

    function buildAnalyzePayload() {
        const name = document.getElementById('cocktail-name')?.value?.trim() || '';
        const description = document.getElementById('cocktail-description')?.value?.trim() || '';
        const stepsContainer = document.getElementById('steps-container');
        const stepInputs = stepsContainer ? stepsContainer.querySelectorAll('.step-input') : [];
        const steps = Array.from(stepInputs).map(input => input.value.trim()).filter(Boolean);

        return {
            name,
            description,
            ingredients: selectedIngredients.map(ing => ({
                name: ing.name,
                volume: Number.parseFloat(ing.volume) || 0,
                abv: Number.parseFloat(ing.abv) || 0
            })),
            steps
        };
    }

    function setAiAnalyzeLoading(isLoading) {
        const analyzeBtn = document.getElementById('ai-analyze-btn');
        const spinner = analyzeBtn?.querySelector('.loading-spinner');
        const btnText = analyzeBtn?.querySelector('.btn-text');

        if (analyzeBtn) {
            analyzeBtn.disabled = isLoading;
            analyzeBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        }
        if (spinner) {
            spinner.classList.toggle('is-visible', isLoading);
        }
        if (btnText) {
            btnText.textContent = isLoading ? '分析中...' : '分析口味特征';
        }
    }

    function renderAiAnalysisResult(analysisText, analyzedAt) {
        const resultEl = document.getElementById('ai-analysis-result');
        const contentEl = document.getElementById('analysis-content');
        const metaEl = document.getElementById('analysis-meta');

        if (contentEl) {
            const escaped = String(analysisText)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
            contentEl.innerHTML = escaped;
        }

        if (metaEl) {
            const timeLabel = analyzedAt ? new Date(analyzedAt).toLocaleString() : new Date().toLocaleString();
            metaEl.textContent = `分析时间：${timeLabel}`;
        }

        if (resultEl) {
            resultEl.hidden = false;
            resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function updateAiAnalyzeState() {
        const analyzeBtn = document.getElementById('ai-analyze-btn');
        if (!analyzeBtn) return;

        const hasIngredients = selectedIngredients.length > 0;
        analyzeBtn.disabled = !hasIngredients;
    }

    async function generateAiRecipe(isRegenerate = false) {
        const payload = buildGeneratePayload();

        if (!payload.tasteDescription) {
            return showErrorMessage('请先输入口味描述，再生成AI配方');
        }

        if (!isRegenerate || !lastGeneratePayload) {
            lastGeneratePayload = payload;
        }

        setAiGenerateLoading(true);

        try {
            const response = await fetch('/api/custom/generate-recipe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(lastGeneratePayload)
            });

            let data = null;
            try {
                data = await response.json();
            } catch (_) {
                data = null;
            }

            if (!response.ok) {
                throw new Error(data?.message || 'AI配方生成失败，请稍后重试');
            }

            if (!data || !data.recipe) {
                throw new Error('AI服务返回数据不完整，请重试');
            }

            generatedRecipe = data.recipe;
            renderGeneratedRecipe(generatedRecipe);

        } catch (error) {
            console.error('生成AI配方失败:', error);
            showErrorMessage(error.message || '生成AI配方失败，请稍后重试');
        } finally {
            setAiGenerateLoading(false);
        }
    }

    function buildGeneratePayload() {
        const tasteDescription = document.getElementById('taste-description')?.value?.trim() || '';
        const occasion = document.getElementById('occasion-select')?.value || '';
        const alcoholStrength = document.getElementById('strength-select')?.value || '';

        return {
            tasteDescription,
            occasion,
            alcoholStrength
        };
    }

    function setAiGenerateLoading(isLoading) {
        const generateBtn = document.getElementById('ai-generate-btn');
        const regenerateBtn = document.getElementById('regenerate-btn');
        const applyBtn = document.getElementById('apply-recipe-btn');
        const spinner = generateBtn?.querySelector('.loading-spinner');
        const btnText = generateBtn?.querySelector('.btn-text');

        if (generateBtn) generateBtn.disabled = isLoading;
        if (regenerateBtn) regenerateBtn.disabled = isLoading;
        if (applyBtn) applyBtn.disabled = isLoading;
        if (generateBtn) generateBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        if (spinner) spinner.classList.toggle('is-visible', isLoading);
        if (btnText) btnText.textContent = isLoading ? '生成中...' : '生成 AI 配方';
    }

    function renderGeneratedRecipe(recipe) {
        const resultEl = document.getElementById('ai-recipe-result');
        const nameEl = document.getElementById('generated-recipe-name');
        const descriptionEl = document.getElementById('generated-recipe-description');
        const ingredientsEl = document.getElementById('generated-ingredients');
        const stepsEl = document.getElementById('generated-steps');
        const tasteProfileEl = document.getElementById('taste-profile');
        const tipsEl = document.getElementById('recipe-tips');

        if (nameEl) nameEl.textContent = recipe.name || 'AI推荐配方';
        if (descriptionEl) descriptionEl.textContent = recipe.description || '已为您生成配方建议';

        if (ingredientsEl) {
            ingredientsEl.innerHTML = '';
            const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
            if (ingredients.length === 0) {
                ingredientsEl.textContent = '暂无原料信息';
            } else {
                ingredients.forEach((ing) => {
                    const item = document.createElement('div');
                    const volume = Number.isFinite(Number(ing.volume)) ? Number(ing.volume) : 0;
                    const abv = Number.isFinite(Number(ing.abv)) ? Number(ing.abv) : 0;
                    item.textContent = `${ing.name || '未命名原料'} - ${volume}ml${abv > 0 ? ` (${abv}%)` : ''}`;
                    ingredientsEl.appendChild(item);
                });
            }
        }

        if (stepsEl) {
            stepsEl.innerHTML = '';
            const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
            if (steps.length === 0) {
                const emptyStep = document.createElement('li');
                emptyStep.textContent = '暂无制作步骤';
                stepsEl.appendChild(emptyStep);
            } else {
                steps.forEach((step) => {
                    const li = document.createElement('li');
                    li.textContent = step;
                    stepsEl.appendChild(li);
                });
            }
        }

        if (tasteProfileEl) {
            tasteProfileEl.innerHTML = '';
            const profile = recipe.taste_profile && typeof recipe.taste_profile === 'object' ? recipe.taste_profile : {};
            const profileMap = [
                ['sweetness', '甜度'],
                ['sourness', '酸度'],
                ['bitterness', '苦度'],
                ['strength', '烈度']
            ];

            let hasProfile = false;
            profileMap.forEach(([key, label]) => {
                if (profile[key] !== undefined && profile[key] !== null && profile[key] !== '') {
                    hasProfile = true;
                    const row = document.createElement('div');
                    row.textContent = `${label}: ${profile[key]}`;
                    tasteProfileEl.appendChild(row);
                }
            });

            if (!hasProfile) {
                tasteProfileEl.textContent = '暂无口味特征数据';
            }
        }

        if (tipsEl) tipsEl.textContent = recipe.tips || '可根据个人口味微调原料比例';

        if (resultEl) {
            resultEl.hidden = false;
            resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function applyGeneratedRecipeToForm() {
        if (!generatedRecipe) {
            return showErrorMessage('请先生成AI配方，再应用到表单');
        }

        const nameInput = document.getElementById('cocktail-name');
        const descInput = document.getElementById('cocktail-description');
        const stepsContainer = document.getElementById('steps-container');

        if (nameInput && generatedRecipe.name) {
            nameInput.value = generatedRecipe.name;
        }

        if (descInput && generatedRecipe.description) {
            descInput.value = generatedRecipe.description;
        }

        const aiIngredients = Array.isArray(generatedRecipe.ingredients) ? generatedRecipe.ingredients : [];
        selectedIngredients = aiIngredients.map((ing, index) => {
            const matched = findIngredientInLibrary(ing.name);
            const parsedVolume = Number.parseFloat(ing.volume);
            const parsedAbv = Number.parseFloat(ing.abv);

            return {
                id: matched ? matched.id : `ai_${Date.now()}_${index}`,
                name: ing.name || `AI原料${index + 1}`,
                volume: Number.isFinite(parsedVolume) ? parsedVolume : 30,
                abv: Number.isFinite(parsedAbv) ? parsedAbv : (matched ? matched.abv : 0),
                category: matched ? matched.category : (ing.category || 'other'),
                unit: matched ? matched.unit : 'ml'
            };
        });

        renderSelectedIngredients();
        updateAbvCalculation();
        updateSubmitState();
        updateAiAnalyzeState();
        highlightSelectedItemsInList();

        if (stepsContainer) {
            stepsContainer.innerHTML = '';
            const aiSteps = Array.isArray(generatedRecipe.steps) ? generatedRecipe.steps : [];
            if (aiSteps.length === 0) {
                addPreparationStep('');
            } else {
                aiSteps.forEach(step => addPreparationStep(step));
            }
        }

        showSuccessMessage('AI配方已应用到下方表单，您可以继续微调后保存。');
    }

    function findIngredientInLibrary(name) {
        if (!name || !allIngredients.ingredients) return null;
        const normalizedName = String(name).trim().toLowerCase();

        for (const category of allIngredients.ingredients) {
            const match = category.items.find(item => item.name.toLowerCase() === normalizedName);
            if (match) {
                return {
                    ...match,
                    category: category.category
                };
            }
        }

        return null;
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
        updateSubmitState();
        
        // 高亮左侧
        const el = document.querySelector(`.ingredient-item[data-id="${id}"]`);
        if(el) el.classList.add('selected');
    }

    function removeIngredientFromSelection(id) {
        selectedIngredients = selectedIngredients.filter(i => i.id != id);
        renderSelectedIngredients();
        updateAbvCalculation();
        updateSubmitState();
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
                <button type="button" class="remove-selected-btn" aria-label="移除原料">
                    ${TRASH_ICON_SVG}
                </button>
            `;
            list.appendChild(div);
        });
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
            <button type="button" class="remove-step-btn" title="删除步骤" aria-label="删除步骤">
                ${TRASH_ICON_SVG}
            </button>
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
        abvEl.classList.toggle('abv-value-high', abv > 20);
        abvEl.classList.toggle('abv-value-low', abv <= 20);
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

    // 控制提交按钮的可用状态
    function updateSubmitState() {
        const submitBtn = document.getElementById('create-cocktail-btn');
        const nameInput = document.getElementById('cocktail-name');
        if (!submitBtn || !nameInput) return;

        const hasName = nameInput.value.trim().length > 0;
        const hasIngredients = selectedIngredients.length > 0;
        submitBtn.disabled = !(hasName && hasIngredients);
        updateAiAnalyzeState();
    }

    function showErrorMessage(msg) {
        showAlert(msg, 'error');
    }

    function showSuccessMessage(msg) {
        showAlert(msg, 'success');
    }

    function showAlert(msg, type = 'error') {
        const alertEl = document.getElementById('alert-container');
        if (!alertEl) {
            if (type === 'error') alert(msg);
            return;
        }

        alertEl.textContent = msg;
        alertEl.classList.remove('alert-success', 'alert-error');
        alertEl.classList.add(type === 'success' ? 'alert-success' : 'alert-error', 'show');

        window.clearTimeout(showAlert.timerId);
        showAlert.timerId = window.setTimeout(() => {
            alertEl.classList.remove('show');
        }, 3600);
    }

    // --- 图片上传相关功能 ---
    function setupImageUpload() {
        const fileInput = document.getElementById('cocktail-image');
        const uploadBtn = document.getElementById('upload-image-btn');
        const previewImg = document.getElementById('preview-img');

        // 点击上传按钮 -> 触发文件选择
        uploadBtn?.addEventListener('click', () => {
            fileInput?.click();
        });

        // 点击预览图片 -> 触发文件选择
        previewImg?.addEventListener('click', () => {
            fileInput?.click();
        });

        // 文件选择后 -> 显示预览
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    showImagePreview(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function showImagePreview(imageSrc) {
        const previewContainer = document.getElementById('image-preview');
        const uploadBtn = document.getElementById('upload-image-btn');
        const previewImg = document.getElementById('preview-img');

        if (previewImg && previewContainer && uploadBtn) {
            previewImg.src = imageSrc;
            previewContainer.hidden = false;
            uploadBtn.hidden = true;
        }
    }

    // 启动
    initialize();
});
