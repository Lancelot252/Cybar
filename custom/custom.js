document.addEventListener('DOMContentLoaded', () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const params = new URLSearchParams(location.search);
  const editId = params.get('id');
  const DRAFT_VERSION = 2;
  const DRAFT_KEY = `cybar:recipe-draft:v${DRAFT_VERSION}:${editId || 'new'}`;
  const analysisMemory = new Map();
  let allIngredients = [];
  let activeCategory = 'all';
  let selected = [];
  let steps = [];
  let currentStep = 1;
  let aiRecipe = null;
  let generatedImageToken = null;
  let generatedImageExpiresAt = null;
  let localImageFile = null;
  let isLoggedIn = false;
  let saveTimer;

  const categoryNames = {
    all: '全部',
    base_alcohol: '基酒',
    liqueur: '利口酒',
    liqueurs: '利口酒',
    vermouth_wine: '味美思与葡萄酒',
    bitters: '苦精',
    juice: '果汁',
    syrup: '糖浆',
    mixer: '调和饮料',
    soda_mixer: '苏打与调和饮料',
    dairy_cream: '乳制品与奶油',
    garnish: '装饰',
    other: '其他'
  };
  const tasteNames = { sweetness: '甜度', sourness: '酸度', bitterness: '苦度', strength: '烈度', freshness: '清爽' };

  function alert(message, type = 'error') {
    const box = $('#alert-container'); box.textContent = message; box.className = `alert ${type}`; box.hidden = false;
    window.clearTimeout(box._timer); box._timer = window.setTimeout(() => { box.hidden = true; }, 5000);
  }
  async function request(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.message || '请求失败'); error.status = response.status; error.code = data.code; throw error; }
    return data;
  }
  function valid() { return $('#cocktail-name').value.trim() && selected.some(item => item.name.trim() && Number(item.volume) > 0); }
  function abv() {
    const total = selected.reduce((sum, item) => sum + Number(item.volume || 0), 0);
    const alcohol = selected.reduce((sum, item) => sum + Number(item.volume || 0) * Number(item.abv || 0) / 100, 0);
    return total ? alcohol / total * 100 : 0;
  }
  function totalVolume() { return selected.reduce((sum, item) => sum + Number(item.volume || 0), 0); }
  function recipePayload() { return { name: $('#cocktail-name').value.trim(), description: $('#cocktail-description').value.trim(), ingredients: selected.map(({ name, volume, abv }) => ({ name, volume: Number(volume), abv: Number(abv) })), steps: [...steps] }; }
  function analysisKey() { return JSON.stringify(recipePayload()); }

  function updatePreview() {
    const name = $('#cocktail-name').value.trim() || '未命名配方';
    $$('[data-preview-name]').forEach(el => { el.textContent = name; });
    $$('[data-preview-abv]').forEach(el => { el.textContent = `${abv().toFixed(1)}%`; });
    $$('[data-preview-volume]').forEach(el => { el.textContent = `${Math.round(totalVolume())} ml`; });
    $('#preview-ingredients').innerHTML = selected.length ? `<ul>${selected.map(item => `<li>${escapeHtml(item.name)} · ${Number(item.volume) || 0} ml</li>`).join('')}</ul>` : '<p>添加原料后将在这里预览</p>';
    $('#mobile-preview-detail').innerHTML = selected.length ? selected.map(item => `${escapeHtml(item.name)} ${Number(item.volume) || 0}ml`).join(' · ') : '添加原料后将在这里预览';
    $('#create-cocktail-btn').disabled = !valid();
    $('#ai-analyze-btn').disabled = !selected.length;
    $('#ai-image-btn').disabled = !isLoggedIn || !valid();
    $('[data-step-summary="1"]').textContent = $('#cocktail-name').value.trim() || '开始构思你的新配方';
    $('[data-step-summary="2"]').textContent = selected.length ? `已选 ${selected.length} 种 · ${Math.round(totalVolume())} ml` : '尚未选择';
    $('[data-step-summary="3"]').textContent = steps.length ? `已添加 ${steps.length} 步` : '尚未添加';
    $('[data-step-summary="4"]').textContent = valid() ? '可以创建' : '等待完成';
    scheduleDraft();
  }
  function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }

  function setStep(step, focus = false) {
    currentStep = Math.max(1, Math.min(4, Number(step)));
    $$('.workflow-step').forEach(section => {
      const open = Number(section.dataset.step) === currentStep;
      section.classList.toggle('open', open);
      const button = $('.step-heading', section); if (button) button.setAttribute('aria-expanded', String(open));
      const panel = $('.step-panel', section); panel.hidden = !open;
    });
    $$('[data-track-step]').forEach(item => item.classList.toggle('active', Number(item.dataset.trackStep) === currentStep));
    const nextLabels = ['下一步：选择原料', '下一步：制作步骤', '下一步：预览并创建', valid() ? (editId ? '保存修改' : '创建鸡尾酒') : '请先完善配方'];
    $('#next-step-btn').textContent = nextLabels[currentStep - 1];
    $('#next-step-btn').disabled = currentStep === 4 && !valid();
    if (focus) $(`.workflow-step[data-step="${currentStep}"]`).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    scheduleDraft();
  }
  function renderCategories() {
    const categories = ['all', ...new Set(allIngredients.map(item => item.category))];
    $('#ingredient-categories').innerHTML = categories.map(category => `<button type="button" role="tab" aria-selected="${category === activeCategory}" class="${category === activeCategory ? 'active' : ''}" data-category="${escapeHtml(category)}">${categoryNames[category] || category}</button>`).join('');
  }
  function renderAvailable() {
    const query = $('#ingredient-search').value.trim().toLowerCase();
    const matches = allIngredients.filter(item => (activeCategory === 'all' || item.category === activeCategory) && item.name.toLowerCase().includes(query));
    $('#ingredients-list').innerHTML = matches.length ? matches.map(item => `<div class="ingredient-item"><span>${escapeHtml(item.name)} <small>${Number(item.abv) || 0}%</small></span><button type="button" data-add="${escapeHtml(item.id)}">添加</button></div>`).join('') : '<p class="empty">没有匹配的原料</p>';
  }
  function renderSelected() {
    $('#selected-count').textContent = selected.length;
    $('#selected-ingredients-list').innerHTML = selected.length ? selected.map((item, index) => `<div class="selected-row"><span>${escapeHtml(item.name)}</span><label class="selected-value-field"><input inputmode="decimal" aria-label="${escapeHtml(item.name)}用量（毫升）" data-volume="${index}" type="number" min="0" step="1" value="${item.volume}"><span>ml</span></label><label class="selected-value-field"><input inputmode="decimal" aria-label="${escapeHtml(item.name)}酒精度（百分比）" data-abv="${index}" type="number" min="0" max="100" step="0.1" value="${item.abv}"><span>%</span></label><button type="button" aria-label="移除${escapeHtml(item.name)}" data-remove="${index}">×</button></div>`).join('') : '<p class="empty">尚未选择任何原料</p>';
    updatePreview();
  }
  function renderSteps() {
    $('#steps-container').innerHTML = steps.map((step, index) => `<div class="step-row"><b>${index + 1}</b><textarea rows="2" data-step-input="${index}" aria-label="步骤 ${index + 1}" placeholder="描述这一步如何制作">${escapeHtml(step)}</textarea><button type="button" data-remove-step="${index}" aria-label="删除步骤 ${index + 1}">×</button></div>`).join('');
    updatePreview();
  }
  function applyRecipe(recipe) {
    $('#cocktail-name').value = recipe.name || '';
    $('#cocktail-description').value = recipe.description || '';
    selected = (recipe.ingredients || []).map((item, index) => ({ id: `ai-${Date.now()}-${index}`, name: item.name, volume: Number(item.volume), abv: Number(item.abv) }));
    steps = (recipe.steps || []).map(String);
    renderSelected(); renderSteps(); updateCounters();
    alert('AI 配方已应用，你仍可以自由修改。', 'success');
  }
  function updateCounters() { $('#taste-count').textContent = $('#taste-description').value.length; $('#description-count').textContent = $('#cocktail-description').value.length; }

  function draftData() { return { version: DRAFT_VERSION, savedAt: new Date().toISOString(), currentStep, taste: $('#taste-description').value, occasion: $('#occasion-select').value, strength: $('#strength-select').value, ...recipePayload(), generatedImageToken: generatedImageExpiresAt && Date.parse(generatedImageExpiresAt) > Date.now() ? generatedImageToken : null, generatedImageExpiresAt: generatedImageExpiresAt && Date.parse(generatedImageExpiresAt) > Date.now() ? generatedImageExpiresAt : null, generatedPreviewUrl: generatedImageToken ? $('#preview-img').src : null }; }
  function scheduleDraft() { window.clearTimeout(saveTimer); saveTimer = window.setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData())), 400); }
  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); if (!draft || draft.version !== DRAFT_VERSION) return false;
      $('#taste-description').value = draft.taste || ''; $('#occasion-select').value = draft.occasion || ''; $('#strength-select').value = draft.strength || '';
      $('#cocktail-name').value = draft.name || ''; $('#cocktail-description').value = draft.description || '';
      selected = Array.isArray(draft.ingredients) ? draft.ingredients.map((item, index) => ({ id: `draft-${index}`, ...item })) : [];
      steps = Array.isArray(draft.steps) ? draft.steps : [];
      if (draft.generatedImageToken && Date.parse(draft.generatedImageExpiresAt) > Date.now()) { generatedImageToken = draft.generatedImageToken; generatedImageExpiresAt = draft.generatedImageExpiresAt; $('#preview-img').src = draft.generatedPreviewUrl; }
      setStep(draft.currentStep || 1); $('#draft-notice').hidden = false; return true;
    } catch { localStorage.removeItem(DRAFT_KEY); return false; }
  }
  function clearDraft(reset = true) {
    localStorage.removeItem(DRAFT_KEY);
    if (!reset) return;
    $('#custom-cocktail-form').reset(); selected = []; steps = []; aiRecipe = null; generatedImageToken = null; generatedImageExpiresAt = null; localImageFile = null;
    $('#preview-img').src = '/custom/assets/empty-coupe.png'; $('#ai-recipe-result').hidden = true; $('#ai-analysis-result').hidden = true; renderSelected(); renderSteps(); updateCounters(); setStep(1); alert('草稿已清空。', 'success');
  }

  async function generateRecipe() {
    const taste = $('#taste-description').value.trim(); if (!taste) return alert('请先描述你想要的风味、场景或记忆。');
    const button = $('#ai-generate-btn'); button.disabled = true; button.textContent = '正在构思配方…';
    try {
      const data = await request('/api/custom/generate-recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasteDescription: taste, occasion: $('#occasion-select').value, alcoholStrength: $('#strength-select').value }) });
      aiRecipe = data.recipe; $('#generated-recipe-name').textContent = aiRecipe.name; $('#generated-recipe-description').textContent = `${aiRecipe.description} · ${aiRecipe.ingredients.length} 种原料`; $('#ai-recipe-result').hidden = false;
    } catch (error) { alert(error.status === 401 ? '请先登录再使用 AI 配方生成。' : error.message); }
    finally { button.disabled = false; button.textContent = '✣　生成 AI 配方'; }
  }
  async function analyze() {
    const key = analysisKey(); const button = $('#ai-analyze-btn'); button.disabled = true; button.textContent = '分析中…';
    try {
      const data = analysisMemory.get(key) || await request('/api/custom/analyze-flavor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipePayload()) });
      analysisMemory.set(key, data); renderAnalysis(data);
    } catch (error) { alert(error.message); }
    finally { button.disabled = !selected.length; button.textContent = '分析口味特征'; }
  }
  function renderAnalysis(data) {
    const profile = data.tasteProfile || {};
    const bars = Object.entries(tasteNames).map(([key, label]) => `<div><span>${label}</span><i style="--score:${Math.max(0, Math.min(10, Number(profile[key]) || 0)) * 10}%"></i><b>${Number(profile[key] || 0).toFixed(1)}</b></div>`).join('');
    $('#ai-analysis-result').innerHTML = `<div class="taste-bars">${bars}</div><p>${escapeHtml(data.analysis)}</p><small>${data.cache?.hit ? `${data.cache.layer} 缓存${data.cache.stale ? '（过期回退）' : ''}` : `由 ${escapeHtml(data.model || 'AI')} 新分析`}</small>`;
    $('#ai-analysis-result').hidden = false;
  }
  async function generateImage() {
    const button = $('#ai-image-btn'); button.disabled = true; button.textContent = '正在生成，不影响继续编辑…'; $('#image-status').textContent = '正在生成配图，请稍候。';
    try {
      const data = await request('/api/custom/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipePayload()) });
      generatedImageToken = data.token; generatedImageExpiresAt = data.expiresAt; localImageFile = null; $('#cocktail-image').value = ''; $('#preview-img').src = data.previewUrl; $('#image-status').textContent = `AI 配图已生成，令牌有效至 ${new Date(data.expiresAt).toLocaleString()}`; scheduleDraft();
    } catch (error) { $('#image-status').textContent = `生成失败：${error.message}。可重试，配方内容未受影响。`; }
    finally { button.disabled = !isLoggedIn || !valid(); button.textContent = '✣　AI 生成配图'; }
  }
  async function submit() {
    if (!valid()) return alert('请填写配方名称并添加至少一种有效原料。');
    const button = $('#create-cocktail-btn'); button.disabled = true; button.textContent = editId ? '保存中…' : '创建中…';
    const form = new FormData(); const payload = recipePayload();
    form.set('name', payload.name); form.set('description', payload.description); form.set('ingredients', JSON.stringify(payload.ingredients)); form.set('steps', JSON.stringify(payload.steps)); form.set('estimatedAbv', abv().toFixed(2));
    if (localImageFile) form.set('image', localImageFile); else if (generatedImageToken) form.set('generatedImageToken', generatedImageToken);
    try {
      const url = editId ? `/api/custom/cocktails/${encodeURIComponent(editId)}` : '/api/custom/cocktails';
      const data = await request(url, { method: editId ? 'PUT' : 'POST', body: form }); clearDraft(false); location.href = `/recipes/detail.html?id=${encodeURIComponent(data.id)}`;
    } catch (error) { alert(error.status === 401 ? '请先登录再创建配方。' : error.message); button.disabled = false; button.textContent = editId ? '保存修改' : '创建鸡尾酒'; }
  }
  async function loadEdit() {
    if (!editId) return;
    try {
      const recipe = await request(`/api/custom/cocktails/${encodeURIComponent(editId)}`);
      $('#cocktail-name').value = recipe.name || ''; $('#cocktail-description').value = recipe.description || '';
      selected = (recipe.ingredients || []).map(item => ({ id: `stored-${item.id}`, name: item.name, volume: Number(item.volume), abv: Number(item.abv) }));
      steps = String(recipe.instructions || '').split(/\r?\n/).filter(Boolean); if (recipe.image) $('#preview-img').src = recipe.image;
    } catch (error) { alert(error.message); }
  }

  $$('.step-heading').forEach(button => button.addEventListener('click', () => setStep(button.closest('.workflow-step').dataset.step, true)));
  $$('[data-track-step]').forEach(item => { item.tabIndex = 0; item.addEventListener('click', () => setStep(item.dataset.trackStep, true)); item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStep(item.dataset.trackStep, true); } }); });
  $('#ai-panel-toggle').addEventListener('click', () => { const body = $('#ai-panel-body'); body.hidden = !body.hidden; $('#ai-panel-toggle').setAttribute('aria-expanded', String(!body.hidden)); });
  $('#mobile-preview-toggle').addEventListener('click', () => { const detail = $('#mobile-preview-detail'); detail.hidden = !detail.hidden; $('#mobile-preview-toggle').setAttribute('aria-expanded', String(!detail.hidden)); });
  $('#ingredient-categories').addEventListener('click', e => { const button = e.target.closest('[data-category]'); if (!button) return; activeCategory = button.dataset.category; renderCategories(); renderAvailable(); });
  $('#ingredients-list').addEventListener('click', e => { const button = e.target.closest('[data-add]'); if (!button) return; const item = allIngredients.find(i => i.id === button.dataset.add); if (!item) return; const existing = selected.find(i => i.id === item.id); if (existing) existing.volume += 30; else selected.push({ ...item, volume: 30 }); renderSelected(); });
  $('#selected-ingredients-list').addEventListener('input', e => { const index = Number(e.target.dataset.volume ?? e.target.dataset.abv); if (Number.isNaN(index)) return; if (e.target.dataset.volume !== undefined) selected[index].volume = Number(e.target.value); else selected[index].abv = Number(e.target.value); updatePreview(); });
  $('#selected-ingredients-list').addEventListener('click', e => { const button = e.target.closest('[data-remove]'); if (!button) return; selected.splice(Number(button.dataset.remove), 1); renderSelected(); });
  $('#add-custom-ingredient').addEventListener('click', () => { const name = window.prompt('自定义原料名称'); if (!name?.trim()) return; selected.push({ id: `custom-${Date.now()}`, name: name.trim(), volume: 30, abv: 0 }); renderSelected(); });
  $('#add-step-btn').addEventListener('click', () => { steps.push(''); renderSteps(); $(`[data-step-input="${steps.length - 1}"]`)?.focus(); });
  $('#steps-container').addEventListener('input', e => { if (e.target.dataset.stepInput === undefined) return; steps[Number(e.target.dataset.stepInput)] = e.target.value; updatePreview(); });
  $('#steps-container').addEventListener('click', e => { const button = e.target.closest('[data-remove-step]'); if (!button) return; steps.splice(Number(button.dataset.removeStep), 1); renderSteps(); });
  ['#cocktail-name','#cocktail-description','#taste-description'].forEach(selector => $(selector).addEventListener('input', () => { updateCounters(); updatePreview(); }));
  ['#occasion-select','#strength-select'].forEach(selector => $(selector).addEventListener('change', scheduleDraft));
  $('#ingredient-search').addEventListener('input', renderAvailable); $('#ai-generate-btn').addEventListener('click', generateRecipe); $('#regenerate-btn').addEventListener('click', generateRecipe); $('#apply-recipe-btn').addEventListener('click', () => aiRecipe && applyRecipe(aiRecipe));
  $('#ai-analyze-btn').addEventListener('click', analyze); $('#ai-image-btn').addEventListener('click', generateImage); $('#create-cocktail-btn').addEventListener('click', submit); $('#clear-draft-btn').addEventListener('click', () => clearDraft(true));
  $('#next-step-btn').addEventListener('click', () => currentStep < 4 ? setStep(currentStep + 1, true) : submit()); $('[data-dismiss-notice]').addEventListener('click', () => { $('#draft-notice').hidden = true; });
  $('#preview-upload-btn').addEventListener('click', () => $('#cocktail-image').click()); $('#cocktail-image').addEventListener('change', e => { localImageFile = e.target.files[0] || null; if (!localImageFile) return; generatedImageToken = null; generatedImageExpiresAt = null; $('#preview-img').src = URL.createObjectURL(localImageFile); $('#image-status').textContent = '已选择本地图片；保存时将优先使用。'; });

  (async () => {
    try { const status = await request('/api/auth/status'); isLoggedIn = Boolean(status.loggedIn); $('#ai-availability').textContent = isLoggedIn ? 'AI 配方不会覆盖手动内容，确认后再应用。' : '登录后可生成 AI 配方与配图'; }
    catch { isLoggedIn = false; }
    try { const data = await request('/api/custom/ingredients'); allIngredients = (data.ingredients || []).flatMap(group => (group.items || []).map(item => ({ ...item, category: group.category }))); }
    catch (error) { alert(error.message); }
    await loadEdit(); const restored = restoreDraft(); if (!restored) setStep(1); renderCategories(); renderAvailable(); renderSelected(); renderSteps(); updateCounters(); updatePreview();
    if (editId) { $('#create-cocktail-btn').textContent = '保存修改'; document.title = '编辑配方 · Cybar'; }
  })();
});
