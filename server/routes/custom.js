const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const dbPool = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');
const ai = require('../services/aiClient');
const { getAnalysis, cleanupOldEntries, normalizeRecipe } = require('../services/analysisCache');
const { downloadTemporaryImage, verifyToken, promoteGeneratedImage, cleanupTemporaryImages } = require('../services/generatedImages');
const { createRateLimit } = require('../services/rateLimit');
const { createImageUpload, persistImage } = require('../services/imageUpload');

const router = express.Router();
const ROOT_DIR = path.join(__dirname, '..', '..');
const INGREDIENTS_FILE = path.join(ROOT_DIR, 'custom', 'ingredients.json');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads', 'cocktails');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = createImageUpload('image');

function localCocktailImage(webPath) {
    if (!String(webPath || '').startsWith('/uploads/cocktails/')) return null;
    const target = path.resolve(UPLOAD_DIR, path.basename(String(webPath)));
    return path.dirname(target) === path.resolve(UPLOAD_DIR) ? target : null;
}

const analysisLimit = createRateLimit({
    name: 'analysis', limit: Number(process.env.AI_ANALYSIS_RATE_LIMIT || 60),
    windowMs: Number(process.env.AI_ANALYSIS_RATE_WINDOW_MS || 600000), key: req => req.ip
});
const generationLimit = createRateLimit({
    name: 'recipe', limit: Number(process.env.AI_GENERATE_RATE_LIMIT || 10),
    windowMs: Number(process.env.AI_GENERATE_RATE_WINDOW_MS || 3600000), key: req => req.session.userId
});
const imageLimit = createRateLimit({
    name: 'image', limit: Number(process.env.AI_IMAGE_RATE_LIMIT || 10),
    windowMs: Number(process.env.AI_IMAGE_RATE_WINDOW_MS || 3600000), key: req => req.session.userId
});

function apiError(res, error, fallback = '操作失败') {
    const status = error.status || (error.code === 'AI_NOT_CONFIGURED' ? 503 : error.response?.status === 429 ? 429 : 500);
    const safeMessage = status < 500 || error.code === 'AI_NOT_CONFIGURED' ? error.message : fallback;
    return res.status(status).json({ message: safeMessage, code: error.code || 'REQUEST_FAILED' });
}

function parseForm(req) {
    let ingredients; let steps;
    try {
        ingredients = JSON.parse(req.body.ingredients || '[]');
        steps = JSON.parse(req.body.steps || '[]');
    } catch { const error = new Error('配方数据格式无效'); error.status = 400; throw error; }
    const normalized = normalizeRecipe({ name: req.body.name, description: req.body.description, ingredients, steps });
    if (!normalized.name || !normalized.ingredients.length) { const error = new Error('名称和至少一种有效原料为必填项'); error.status = 400; throw error; }
    return { ...normalized, estimatedAbv: Number(req.body.estimatedAbv || 0), totalVolume: normalized.ingredients.reduce((sum, item) => sum + item.volume, 0) };
}

async function saveCocktail(req, res, recipeId = null) {
    let data;
    try { data = parseForm(req); } catch (error) { return apiError(res, error); }
    const isUpdate = Boolean(recipeId);
    let current = null;
    let storedFile = null;
    try {
        if (isUpdate) {
            const [rows] = await dbPool.query('SELECT created_by, image FROM cocktails WHERE id = ?', [recipeId]);
            if (!rows.length) { const error = new Error('配方不存在'); error.status = 404; throw error; }
            current = rows[0];
            if (current.created_by !== req.session.username && req.session.role !== 'admin') { const error = new Error('无权修改此配方'); error.status = 403; throw error; }
        }
        if (req.file) {
            storedFile = await persistImage(req.file, UPLOAD_DIR, `recipe-${String(req.session.userId).replace(/[^a-zA-Z0-9_-]/g, '_')}`);
        }
        let imagePath = storedFile ? `/uploads/cocktails/${storedFile.filename}` : current?.image || null;
        if (!req.file && req.body.generatedImageToken) imagePath = await promoteGeneratedImage(req.body.generatedImageToken, req.session.userId);
        const id = recipeId || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const connection = await dbPool.getConnection();
        try {
            await connection.beginTransaction();
            if (isUpdate) {
                await connection.query('UPDATE cocktails SET name=?, description=?, instructions=?, estimated_abv=?, total_volume=?, image=? WHERE id=?', [data.name, data.description, data.steps.join('\n'), data.estimatedAbv, data.totalVolume, imagePath, id]);
                await connection.query('DELETE FROM ingredients WHERE cocktail_id = ?', [id]);
            } else {
                await connection.query('INSERT INTO cocktails (id,name,description,instructions,estimated_abv,total_volume,created_by,image) VALUES (?,?,?,?,?,?,?,?)', [id, data.name, data.description, data.steps.join('\n'), data.estimatedAbv, data.totalVolume, req.session.username, imagePath]);
            }
            for (const ingredient of data.ingredients) await connection.query('INSERT INTO ingredients (cocktail_id,name,volume,abv) VALUES (?,?,?,?)', [id, ingredient.name, ingredient.volume, ingredient.abv]);
            await connection.commit();
            if (storedFile && current?.image && current.image !== imagePath) {
                const previousImage = localCocktailImage(current.image);
                if (previousImage) await fsp.rm(previousImage, { force: true }).catch(error => console.warn('Old image cleanup failed:', error.message));
            }
            return res.status(isUpdate ? 200 : 201).json({ message: isUpdate ? '修改成功' : '创建成功', id });
        } catch (error) { await connection.rollback(); throw error; }
        finally { connection.release(); }
    } catch (error) {
        if (storedFile) await fsp.rm(storedFile.path, { force: true });
        return apiError(res, error, isUpdate ? '更新配方失败' : '创建配方失败');
    }
}

router.get('/api/custom/ingredients', async (_req, res) => {
    try { res.json(JSON.parse((await fsp.readFile(INGREDIENTS_FILE, 'utf8')).replace(/^\uFEFF/, ''))); }
    catch (error) { apiError(res, error, '加载原料数据失败'); }
});

router.post('/api/custom/cocktails', isAuthenticated, upload, (req, res) => saveCocktail(req, res));
router.put('/api/custom/cocktails/:id', isAuthenticated, upload, (req, res) => saveCocktail(req, res, req.params.id));
router.post('/api/custom/cocktails/:id/update', isAuthenticated, upload, (req, res) => saveCocktail(req, res, req.params.id));

async function deleteCocktail(req, res) {
    try {
        const [rows] = await dbPool.query('SELECT created_by, image FROM cocktails WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ message: '配方不存在' });
        if (rows[0].created_by !== req.session.username && req.session.role !== 'admin') return res.status(403).json({ message: '无权删除此配方' });
        const connection = await dbPool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query('DELETE FROM ingredients WHERE cocktail_id=?', [req.params.id]);
            await connection.query('DELETE FROM comment WHERE thread_id=?', [req.params.id]);
            await connection.query('DELETE FROM likes WHERE recipe_id=?', [req.params.id]);
            await connection.query('DELETE FROM favorites WHERE recipe_id=?', [req.params.id]);
            await connection.query('DELETE FROM cocktails WHERE id=?', [req.params.id]);
            await connection.commit();
        } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
        const imagePath = localCocktailImage(rows[0].image);
        if (imagePath) await fsp.rm(imagePath, { force: true });
        res.json({ message: '删除成功' });
    } catch (error) { apiError(res, error, '删除配方失败'); }
}
router.delete('/api/custom/cocktails/:id', isAuthenticated, deleteCocktail);
router.post('/api/custom/cocktails/:id/delete', isAuthenticated, deleteCocktail);

router.get(['/custom/', '/custom/index.html'], isAuthenticated, (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'custom', 'index.html'));
});

router.get('/api/custom/cocktails', async (_req, res) => {
    try {
        const [cocktails] = await dbPool.query(`SELECT c.id,c.name,c.description,c.image,c.instructions,
            c.estimated_abv AS estimatedAbv,c.total_volume AS totalVolume,c.created_by AS createdBy,
            c.created_at AS createdAt,COUNT(i.id) AS ingredientCount
            FROM cocktails c LEFT JOIN ingredients i ON c.id=i.cocktail_id GROUP BY c.id ORDER BY c.created_at DESC`);
        res.json({ cocktails });
    } catch (error) { apiError(res, error, '获取配方列表失败'); }
});

router.get('/api/custom/cocktails/:id', async (req, res) => {
    try {
        const [cocktails] = await dbPool.query(`SELECT c.id,c.name,c.description,c.image,c.instructions,
            c.estimated_abv AS estimatedAbv,c.total_volume AS totalVolume,c.created_by AS createdBy,
            c.created_at AS createdAt FROM cocktails c WHERE c.id=?`, [req.params.id]);
        if (!cocktails.length) return res.status(404).json({ message: '配方不存在' });
        const [ingredients] = await dbPool.query('SELECT id,cocktail_id,name,volume,abv FROM ingredients WHERE cocktail_id=? ORDER BY id', [req.params.id]);
        res.json({ ...cocktails[0], ingredients });
    } catch (error) { apiError(res, error, '获取配方详情失败'); }
});

router.post('/api/custom/analyze-flavor', analysisLimit, async (req, res) => {
    try {
        const result = await getAnalysis(req.body || {}, ai.analyzeRecipe);
        res.json({ analysis: result.analysis, tasteProfile: result.tasteProfile, model: result.model, analyzedAt: result.analyzedAt, cache: result.cache });
    } catch (error) { apiError(res, error, 'AI 分析暂时不可用'); }
});

router.post('/api/custom/generate-recipe', isAuthenticated, generationLimit, async (req, res) => {
    const tasteDescription = String(req.body?.tasteDescription || '').trim();
    if (!tasteDescription) return res.status(400).json({ message: '请先描述想要的口味', code: 'INVALID_INPUT' });
    try {
        const recipe = await ai.generateRecipe({ tasteDescription, occasion: req.body.occasion, alcoholStrength: req.body.alcoholStrength });
        res.json({ recipe, model: ai.TEXT_MODEL(), generatedAt: new Date().toISOString() });
    } catch (error) { apiError(res, error, 'AI 配方生成暂时不可用'); }
});

router.post('/api/custom/generate-image', isAuthenticated, imageLimit, async (req, res) => {
    const recipe = normalizeRecipe(req.body || {});
    if (!recipe.name || !recipe.ingredients.length) return res.status(400).json({ message: '名称和至少一种原料完整后才能生成配图', code: 'INVALID_INPUT' });
    try {
        const ingredients = recipe.ingredients.map(item => `${item.name} ${item.volume}ml`).join('、');
        const prompt = `专业鸡尾酒产品摄影。以“${recipe.name}”配方为视觉灵感，成品鸡尾酒包含${ingredients}。深海军蓝酒吧背景，冷色轮廓光，真实玻璃与液体质感，竖幅居中构图，只呈现饮品、杯具、装饰和环境。画面中严禁出现任何文字或字符，包括中文、英文字母、数字、符号、酒标、瓶标、菜单、招牌、字幕、商标、Logo 和水印；杯具与背景必须保持无字、无标签。`;
        const providerUrl = await ai.generateImage(prompt);
        const stored = await downloadTemporaryImage(providerUrl, req.session.userId);
        res.json({ previewUrl: `/api/custom/generated-image/${encodeURIComponent(stored.token)}`, token: stored.token, expiresAt: stored.expiresAt });
    } catch (error) { apiError(res, error, 'AI 配图生成暂时不可用'); }
});

router.get('/api/custom/generated-image/:token', isAuthenticated, async (req, res) => {
    try {
        const image = verifyToken(req.params.token, req.session.userId);
        await fsp.access(image.fullPath);
        res.set('Cache-Control', 'private, max-age=300');
        res.sendFile(image.fullPath);
    } catch (error) { res.status(404).json({ message: '图片已过期或不可用' }); }
});

const cleanupTimer = setInterval(() => { Promise.allSettled([cleanupTemporaryImages(), cleanupOldEntries()]); }, 60 * 60 * 1000);
cleanupTimer.unref?.();

router.use((error, req, res, _next) => {
    apiError(res, error, error.name === 'MulterError' ? '图片上传失败' : '请求处理失败');
});

module.exports = router;
