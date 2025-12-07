const express = require('express');
const router = express.Router();
const dbPool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { isAuthenticated } = require('../middleware/auth');

// 项目根目录 (server 的上级目录)
const ROOT_DIR = path.join(__dirname, '..', '..');

// 文件路径常量
const INGREDIENTS_FILE = path.join(ROOT_DIR, 'custom', 'ingredients.json');
const CUSTOM_COCKTAILS_FILE = path.join(ROOT_DIR, 'custom', 'custom_cocktails.json');

// --- Page Routes ---
router.get('/custom/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'custom', 'index.html'));
});

// --- API Routes ---

// 获取所有原料
router.get('/api/custom/ingredients', async (req, res) => {
    try {
        let data = await fs.readFile(INGREDIENTS_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        const ingredients = JSON.parse(data);

        // Filter helper: decide if an item should be considered a liquid
        const isLiquidItem = (item) => {
            if (!item) return false;
            const unit = (item.unit || '').toString().toLowerCase();

            if (unit.includes('毫') || unit.includes('ml') || unit.includes('cl') || unit === 'l') {
                return true;
            }
            if (typeof item.volume === 'number' && item.volume > 0) return true;
            if (typeof item.abv === 'number' && item.abv > 0) return true;

            return false;
        };

        const filtered = { ingredients: [] };
        const allowedNonLiquidCategories = new Set(['garnish', 'dairy_cream', 'other', 'spice_herb']);

        if (Array.isArray(ingredients.ingredients)) {
            for (const cat of ingredients.ingredients) {
                if (!cat || !Array.isArray(cat.items)) continue;

                const catKey = (cat.category || '').toString();

                if (allowedNonLiquidCategories.has(catKey)) {
                    filtered.ingredients.push({
                        category: cat.category,
                        items: cat.items.slice()
                    });
                    continue;
                }

                const liquidItems = cat.items.filter(isLiquidItem);
                if (liquidItems.length > 0) {
                    filtered.ingredients.push({
                        category: cat.category,
                        items: liquidItems
                    });
                }
            }
        }

        // Consolidate leftovers
        try {
            const includedIds = new Set();
            for (const c of filtered.ingredients) {
                for (const it of c.items || []) {
                    if (it && it.id) includedIds.add(it.id);
                }
            }

            const leftovers = [];
            for (const origCat of (ingredients.ingredients || [])) {
                for (const it of (origCat.items || [])) {
                    if (it && it.id && !includedIds.has(it.id)) {
                        leftovers.push(it);
                    }
                }
            }

            if (leftovers.length > 0) {
                let otherCat = filtered.ingredients.find(c => c.category === 'other');
                if (!otherCat) {
                    otherCat = { category: 'other', items: [] };
                    filtered.ingredients.push(otherCat);
                }
                const existing = new Set((otherCat.items || []).map(i => i.id));
                for (const it of leftovers) {
                    if (!existing.has(it.id)) otherCat.items.push(it);
                }
            }
        } catch (e) {
            console.error('Error while consolidating leftover ingredients:', e);
        }

        res.json(filtered);
    } catch (error) {
        console.error("Error reading ingredients:", error);
        res.status(500).json({ message: '加载原料数据失败' });
    }
});

// 创建自定义鸡尾酒
router.post('/api/custom/cocktails', isAuthenticated, async (req, res) => {
    try {
        const newCocktail = req.body;

        if (!newCocktail.name || !newCocktail.ingredients || newCocktail.ingredients.length === 0) {
            return res.status(400).json({ message: '鸡尾酒名称和至少一种原料是必填的' });
        }

        const cocktailId = Date.now().toString();
        const creator = req.session.username;

        // 插入主表 cocktails
        await dbPool.query(
            `INSERT INTO cocktails (id, name, instructions, estimated_abv, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [
                cocktailId,
                newCocktail.name,
                (newCocktail.steps || []).join('\n'),
                newCocktail.estimatedAbv || 0,
                creator
            ]
        );

        // 插入 ingredients 表
        for (const ing of newCocktail.ingredients) {
            await dbPool.query(
                `INSERT INTO ingredients (cocktail_id, name, volume, abv)
                 VALUES (?, ?, ?, ?)`,
                [
                    cocktailId,
                    ing.name,
                    ing.volume,
                    ing.abv
                ]
            );
        }

        res.status(201).json({
            message: '鸡尾酒创建成功',
            id: cocktailId
        });

    } catch (error) {
        console.error("Error creating custom cocktail:", error);
        res.status(500).json({ message: '创建鸡尾酒失败' });
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

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey || apiKey === 'sk-your-api-key-here') {
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

⚠️ 这是演示模式的分析结果。要获得真实的AI分析，请配置有效的Deepseek API密钥。`;
        } else {
            // 调用真实的Deepseek API
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
                    'Authorization': `Bearer ${apiKey}`,
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

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey || apiKey === 'sk-your-api-key-here') {
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
        } else {
            // 调用真实的Deepseek API
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
                    'Authorization': `Bearer ${apiKey}`,
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

module.exports = router;
