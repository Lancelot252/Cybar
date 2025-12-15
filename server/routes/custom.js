const express = require('express');
const router = express.Router();
const dbPool = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { isAuthenticated } = require('../middleware/auth');
const axios = require('axios');

// 定义根目录
const ROOT_DIR = path.join(__dirname, '..', '..');
// 定义 JSON 文件路径 (修复之前可能的 undefined 错误)
const INGREDIENTS_FILE = path.join(ROOT_DIR, 'custom', 'ingredients.json');

// --- [配置 Multer] ---
const uploadDir = path.join(ROOT_DIR, 'uploads', 'cocktails');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `recipe-${req.session.userId}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件！'));
        }
    }
});

// --- 1. 获取原料列表 API ---
router.get('/api/custom/ingredients', async (req, res) => {
    try {
        if (!fs.existsSync(INGREDIENTS_FILE)) {
            console.error("找不到原料文件:", INGREDIENTS_FILE);
            return res.status(404).json({ message: '原料文件不存在' });
        }
        let data = await fs.promises.readFile(INGREDIENTS_FILE, 'utf8');
        // 去除 BOM 头 (如果有)
        if (data.charCodeAt(0) === 0xFEFF) data = data.slice(1);
        const ingredients = JSON.parse(data);
        res.json(ingredients); 
    } catch (error) {
        console.error("读取原料失败:", error);
        res.status(500).json({ message: '加载原料数据失败' });
    }
});

// --- 2. 创建配方 API ---
router.post('/api/custom/cocktails', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const name = req.body.name;
        const description = req.body.description || ''; 
        const estimatedAbv = req.body.estimatedAbv || 0;
        
        let ingredients = [], steps = [];
        try {
            ingredients = JSON.parse(req.body.ingredients || '[]');
            steps = req.body.steps ? JSON.parse(req.body.steps) : [];
        } catch (e) {
            return res.status(400).json({ message: '数据格式错误' });
        }

        let imagePath = null;
        if (req.file) imagePath = '/uploads/cocktails/' + req.file.filename;

        if (!name || ingredients.length === 0) {
            return res.status(400).json({ message: '名称和至少一种原料是必填的' });
        }

        const cocktailId = Date.now().toString();
        const creator = req.session.username;

        // 插入主表
        await dbPool.query(
            `INSERT INTO cocktails (id, name, description, instructions, estimated_abv, created_by, image)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [cocktailId, name, description, Array.isArray(steps) ? steps.join('\n') : steps, estimatedAbv, creator, imagePath]
        );

        // 插入原料表
        for (const ing of ingredients) {
            await dbPool.query(
                `INSERT INTO ingredients (cocktail_id, name, volume, abv) VALUES (?, ?, ?, ?)`,
                [cocktailId, ing.name, ing.volume, ing.abv]
            );
        }

        res.status(201).json({ message: '创建成功', id: cocktailId });
    } catch (error) {
        console.error("创建失败:", error);
        res.status(500).json({ message: '创建失败: ' + error.message });
    }
});

// --- 3. 修改配方 API (PUT) ---
router.put('/api/custom/cocktails/:id', isAuthenticated, upload.single('image'), async (req, res) => {
    const recipeId = req.params.id;
    const username = req.session.username;

    try {
        const [rows] = await dbPool.query('SELECT created_by, image FROM cocktails WHERE id = ?', [recipeId]);
        if (rows.length === 0) return res.status(404).json({ message: '配方不存在' });
        if (rows[0].created_by !== username && req.session.role !== 'admin') {
            return res.status(403).json({ message: '无权修改' });
        }

        const name = req.body.name;
        const description = req.body.description || '';
        const estimatedAbv = req.body.estimatedAbv || 0;
        let ingredients = [], steps = [];
        try {
            ingredients = JSON.parse(req.body.ingredients || '[]');
            steps = req.body.steps ? JSON.parse(req.body.steps) : [];
        } catch (e) { return res.status(400).json({ message: '数据格式错误' }); }

        let imagePath = rows[0].image;
        if (req.file) imagePath = '/uploads/cocktails/' + req.file.filename;

        const conn = await dbPool.getConnection();
        await conn.beginTransaction();
        try {
            await conn.query(
                `UPDATE cocktails SET name=?, description=?, instructions=?, estimated_abv=?, image=? WHERE id=?`,
                [name, description, Array.isArray(steps) ? steps.join('\n') : steps, estimatedAbv, imagePath, recipeId]
            );
            await conn.query('DELETE FROM ingredients WHERE cocktail_id = ?', [recipeId]);
            for (const ing of ingredients) {
                await conn.query(
                    `INSERT INTO ingredients (cocktail_id, name, volume, abv) VALUES (?, ?, ?, ?)`,
                    [recipeId, ing.name, ing.volume, ing.abv]
                );
            }
            await conn.commit();
            res.json({ message: '修改成功', id: recipeId });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error("更新失败:", error);
        res.status(500).json({ message: '更新失败' });
    }
});
// 获取所有自定义鸡尾酒
router.get('/api/custom/cocktails', async (req, res) => {
    try {
        let data = await fs.readFile(CUSTOM_COCKTAILS_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        const customCocktails = JSON.parse(data);
        res.json(customCocktails);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.json({ cocktails: [] });
        }
        console.error("Error reading custom cocktails:", error);
        res.status(500).json({ message: '加载自定义鸡尾酒失败' });
    }
});

// 获取单个自定义鸡尾酒
router.get('/api/custom/cocktails/:id', async (req, res) => {
    const cocktailId = req.params.id;

    try {
        let data = await fs.readFile(CUSTOM_COCKTAILS_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        const customCocktails = JSON.parse(data);

        const cocktail = customCocktails.cocktails.find(c => c.id === cocktailId);
        if (!cocktail) {
            return res.status(404).json({ message: '未找到指定的鸡尾酒' });
        }

        res.json(cocktail);
    } catch (error) {
        console.error(`Error reading custom cocktail ${cocktailId}:`, error);
        res.status(500).json({ message: '加载鸡尾酒详情失败' });
    }
});

// AI口味分析API
router.post('/api/custom/analyze-flavor', async (req, res) => {
    try {
        const { ingredients, steps, name, description } = req.body;

        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ message: '请提供原料信息' });
        }

        const ingredientsList = ingredients.map(ing =>
            `${ing.name} (${ing.volume}ml, 酒精度: ${ing.abv}%)`
        ).join(', ');

        const stepsList = steps && steps.length > 0 ? steps.join(' ') : '未提供制作步骤';

        const prompt = `请分析这个鸡尾酒配方的口味特征并给出专业建议：

鸡尾酒名称: ${name || '未命名'}
描述: ${description || '无描述'}
原料: ${ingredientsList}
制作步骤: ${stepsList}

请按照以下格式提供分析，并在开头包含标准化的口味维度评分：

【口味维度评分】
甜度: X/5 (0-5分，0为无甜味，5为极甜)
酸度: X/5 (0-5分，0为无酸味，5为极酸)
苦度: X/5 (0-5分，0为无苦味，5为极苦)
烈度: X/5 (0-5分，0为无酒精感，5为极烈)
清爽度: X/5 (0-5分，0为厚重，5为极清爽)

【详细分析】
1. 整体口感特征分析
2. 风味层次解析 
3. 颜色和视觉效果
4. 香气特点描述
5. 适合场合和人群
6. 改进建议(如有)
7. 与经典鸡尾酒的相似度对比

请用专业但易懂的语言分析，确保口味评分准确反映原料组合的实际特征。`;

        let analysis;

        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const qwenKey = process.env.QWEN_API_KEY;
        
        if ((!deepseekKey || deepseekKey === 'sk-your-api-key-here') && (!qwenKey || qwenKey === 'sk-your-api-key-here')) {
            // 演示模式
            analysis = `🤖 演示模式分析结果

【口味维度评分】
甜度: 3/5 (来自糖浆和果汁的天然甜味)
酸度: 2/5 (适中的酸度平衡，提供清爽口感)
苦度: 1/5 (轻微的苦味层次)
烈度: 3/5 (酒精感适中，不会过于强烈)
清爽度: 4/5 (口感清新爽口)

【详细分析】

**整体口感特征：**
根据您选择的${ingredients.length}种原料，这款鸡尾酒呈现出丰富的层次感。

⚠️ 这是演示模式的分析结果。要获得真实的AI分析，请配置有效的 DeepSeek 或 Qwen API 密钥。`;
        } else if (qwenKey && qwenKey !== 'sk-your-api-key-here') {
            // 调用 Qwen API
            const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                model: 'qwen-plus',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位专业的调酒师和品酒师，拥有丰富的鸡尾酒知识和品鉴经验。请用专业、友好的语调提供详细的口味分析和建议。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            }, {
                headers: {
                    'Authorization': `Bearer ${qwenKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            analysis = response.data.choices[0].message.content;
        } else {
            // 调用 DeepSeek API
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位专业的调酒师和品酒师，拥有丰富的鸡尾酒知识和品鉴经验。请用专业、友好的语调提供详细的口味分析和建议。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            }, {
                headers: {
                    'Authorization': `Bearer ${deepseekKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            analysis = response.data.choices[0].message.content;
        }

        res.json({
            success: true,
            analysis: analysis,
            analyzedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('AI分析错误:', error);

        if (error.response) {
            if (error.response.status === 401) {
                return res.status(500).json({
                    message: 'AI服务认证失败，请联系管理员配置API密钥',
                    error: 'API_AUTH_ERROR'
                });
            } else if (error.response.status === 429) {
                return res.status(429).json({
                    message: 'AI服务请求过于频繁，请稍后再试',
                    error: 'RATE_LIMIT_ERROR'
                });
            } else {
                return res.status(500).json({
                    message: 'AI分析服务暂时不可用',
                    error: 'API_ERROR'
                });
            }
        } else if (error.code === 'ECONNABORTED') {
            return res.status(408).json({
                message: 'AI分析请求超时，请稍后再试',
                error: 'TIMEOUT_ERROR'
            });
        } else {
            return res.status(500).json({
                message: 'AI口味分析失败，请稍后再试',
                error: 'UNKNOWN_ERROR'
            });
        }
    }
});

// AI智能调酒师 - 根据口味描述生成配方
router.post('/api/custom/generate-recipe', async (req, res) => {
    try {
        const { tasteDescription, occasion, alcoholStrength } = req.body;

        if (!tasteDescription || tasteDescription.trim().length === 0) {
            return res.status(400).json({ message: '请提供口味描述' });
        }

        const prompt = `作为专业调酒师，请根据以下需求创建一个鸡尾酒配方：

用户口味需求：${tasteDescription}
${occasion ? `适用场合：${occasion}` : ''}
${alcoholStrength ? `酒精强度偏好：${alcoholStrength}` : ''}

请提供以下信息，使用JSON格式回答：
{
  "name": "鸡尾酒名称",
  "description": "简短描述（1-2句话）",
  "ingredients": [
    {
      "name": "原料名称",
      "volume": 数量（毫升）,
      "abv": 酒精度（百分比数字）,
      "category": "分类（base_alcohol/juice/syrup/soda/garnish/other）"
    }
  ],
  "steps": ["详细制作步骤1", "详细制作步骤2"],
  "glassware": "推荐杯具",
  "garnish": "装饰建议",
  "taste_profile": {
    "sweetness": "甜度等级（1-5）",
    "sourness": "酸度等级（1-5）",
    "bitterness": "苦度等级（1-5）",
    "strength": "烈度等级（1-5）"
  },
  "tips": "调制小贴士"
}

要求：
1. 原料数量要合理，总量控制在100-200ml之间
2. 步骤要详细具体，易于操作
3. 确保口味平衡，符合用户需求
4. 如果用户要求特定酒精强度，请相应调整
5. 只返回JSON，不要其他文字`;

        let recipe;

        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const qwenKey = process.env.QWEN_API_KEY;
        
        if ((!deepseekKey || deepseekKey === 'sk-your-api-key-here') && (!qwenKey || qwenKey === 'sk-your-api-key-here')) {
            // 演示模式
            recipe = {
                name: "AI灵感特调",
                description: `根据您"${tasteDescription}"的描述，为您推荐这款特色鸡尾酒`,
                ingredients: [
                    { name: "伏特加", volume: 45, abv: 40, category: "base_alcohol" },
                    { name: "蔓越莓汁", volume: 30, abv: 0, category: "juice" },
                    { name: "柠檬汁", volume: 15, abv: 0, category: "juice" },
                    { name: "糖浆", volume: 10, abv: 0, category: "syrup" }
                ],
                steps: [
                    "在调酒器中加入冰块",
                    "依次倒入伏特加、蔓越莓汁、柠檬汁和糖浆",
                    "用力摇晃15-20秒",
                    "用双重过滤器过滤到冰镇的马天尼杯中",
                    "用柠檬皮装饰"
                ],
                glassware: "马天尼杯",
                garnish: "柠檬皮",
                taste_profile: {
                    sweetness: "3",
                    sourness: "2",
                    bitterness: "1",
                    strength: "3"
                },
                tips: "可根据个人喜好调整糖浆用量",
                isDemo: true
            };
        } else if (qwenKey && qwenKey !== 'sk-your-api-key-here') {
            // 调用 Qwen API
            const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                model: 'qwen-plus',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位世界顶级的调酒师，拥有丰富的鸡尾酒创作经验。请根据用户的口味需求,创造出完美的鸡尾酒配方。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 1500
            }, {
                headers: {
                    'Authorization': `Bearer ${qwenKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 35000
            });

            try {
                const jsonMatch = response.data.choices[0].message.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    recipe = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('无法找到JSON格式的配方');
                }
            } catch (parseError) {
                console.error('JSON解析错误:', parseError);
                recipe = {
                    name: "AI推荐配方",
                    description: "AI为您生成的特色配方",
                    raw_response: response.data.choices[0].message.content,
                    error: "配方解析失败，请稍后重试"
                };
            }
        } else {
            // 调用 DeepSeek API
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位世界顶级的调酒师，拥有丰富的鸡尾酒创作经验。请根据用户的口味需求，创造出完美的鸡尾酒配方。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 1500
            }, {
                headers: {
                    'Authorization': `Bearer ${deepseekKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 35000
            });

            try {
                const jsonMatch = response.data.choices[0].message.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    recipe = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('无法找到JSON格式的配方');
                }
            } catch (parseError) {
                console.error('JSON解析错误:', parseError);
                recipe = {
                    name: "AI推荐配方",
                    description: "AI为您生成的特色配方",
                    raw_response: response.data.choices[0].message.content,
                    error: "配方解析失败，请稍后重试"
                };
            }
        }

        res.json({
            success: true,
            recipe: recipe,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('AI配方生成错误:', error);

        if (error.response) {
            if (error.response.status === 401) {
                return res.status(500).json({
                    message: 'AI服务认证失败，请联系管理员配置API密钥',
                    error: 'API_AUTH_ERROR'
                });
            } else if (error.response.status === 429) {
                return res.status(429).json({
                    message: 'AI服务请求过于频繁，请稍后再试',
                    error: 'RATE_LIMIT_ERROR'
                });
            } else {
                return res.status(500).json({
                    message: 'AI配方生成服务暂时不可用',
                    error: 'API_ERROR'
                });
            }
        } else if (error.code === 'ECONNABORTED') {
            return res.status(408).json({
                message: 'AI配方生成请求超时，请稍后再试',
                error: 'TIMEOUT_ERROR'
            });
        } else {
            return res.status(500).json({
                message: 'AI配方生成失败，请稍后再试',
                error: 'UNKNOWN_ERROR'
            });
        }
    }
});

// [新增] 编辑/更新配方接口
router.put('/api/custom/cocktails/:id', isAuthenticated, upload.single('image'), async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.userId;
    const username = req.session.username; // 用于检查权限

    try {
        console.log(`尝试更新配方 ID: ${recipeId}, 用户: ${username}`);

        // 1. 检查权限：配方是否存在？是否是当前用户创建的？
        const [rows] = await dbPool.query(
            'SELECT created_by, image FROM cocktails WHERE id = ?', 
            [recipeId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: '配方不存在' });
        }

        if (rows[0].created_by !== username && req.session.role !== 'admin') {
            return res.status(403).json({ message: '您无权编辑此配方' });
        }

        // 2. 准备数据
        const name = req.body.name;
        let ingredients = [];
        try {
            ingredients = JSON.parse(req.body.ingredients || '[]');
        } catch (e) {
            return res.status(400).json({ message: '原料数据格式错误' });
        }
        const steps = req.body.steps ? JSON.parse(req.body.steps) : [];
        const estimatedAbv = req.body.estimatedAbv || 0;

        // 3. 处理图片逻辑
        // 如果上传了新图，用新图；如果没有上传，保持原图路径 (imagePath = rows[0].image)
        // 如果想支持“删除图片”，前端需要传个标志，这里简化处理：只支持覆盖或保留
        let imagePath = rows[0].image; 
        if (req.file) {
            imagePath = '/uploads/cocktails/' + req.file.filename;
            // (可选) 这里可以顺便把 rows[0].image 指向的旧文件删掉，清理硬盘空间
        }

        // 验证
        if (!name || ingredients.length === 0) {
            return res.status(400).json({ message: '名称和至少一种原料是必填的' });
        }

        // 4. 执行更新 (使用事务保证原子性)
        const connection = await dbPool.getConnection();
        try {
            await connection.beginTransaction();

            // 更新主表
            await connection.query(
                `UPDATE cocktails 
                 SET name = ?, instructions = ?, estimated_abv = ?, image = ? 
                 WHERE id = ?`,
                [
                    name, 
                    Array.isArray(steps) ? steps.join('\n') : steps, 
                    estimatedAbv, 
                    imagePath, 
                    recipeId
                ]
            );

            // 更新原料表：策略是“先删后加”
            await connection.query('DELETE FROM ingredients WHERE cocktail_id = ?', [recipeId]);

            for (const ing of ingredients) {
                await connection.query(
                    `INSERT INTO ingredients (cocktail_id, name, volume, abv)
                     VALUES (?, ?, ?, ?)`,
                    [recipeId, ing.name, ing.volume, ing.abv]
                );
            }

            await connection.commit();
            res.json({ message: '配方修改成功', id: recipeId });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error("更新配方出错:", error);
        res.status(500).json({ message: '更新失败: ' + error.message });
    }
});

module.exports = router;
