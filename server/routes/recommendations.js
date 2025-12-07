const express = require('express');
const router = express.Router();
const dbPool = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// 原料名称规范化映射表
const ingredientNormalizationMap = {
    "金酒 (gin)": "金酒",
    "gin": "金酒",
    "伏特加 (vodka)": "伏特加",
    "vodka": "伏特加",
    "朗姆酒 (rum)": "朗姆酒",
    "rum": "朗姆酒",
    "龙舌兰 (tequila)": "龙舌兰",
    "tequila": "龙舌兰",
    "威士忌 (whiskey)": "威士忌",
    "whiskey": "威士忌",
    "whisky": "威士忌",
    "白兰地 (brandy)": "白兰地",
    "brandy": "白兰地",
    "利口酒 (liqueur)": "利口酒",
    "liqueur": "利口酒",
    "苦精 (bitters)": "苦精",
    "bitters": "苦精",
    "苏打水 (soda)": "苏打水",
    "soda": "苏打水",
    "汤力水 (tonic)": "汤力水",
    "tonic": "汤力水",
    "柠檬汁 (lemon juice)": "柠檬汁",
    "lemon juice": "柠檬汁",
    "青柠汁 (lime juice)": "青柠汁",
    "lime juice": "青柠汁"
};

// 原料名称规范化函数
const normalizeIngredient = (ingredient) => {
    const lowerIngredient = ingredient.toLowerCase().trim();

    for (const [key, value] of Object.entries(ingredientNormalizationMap)) {
        if (lowerIngredient === key.toLowerCase()) {
            return value;
        }
    }

    return ingredient.replace(/\(.*?\)/g, '').trim();
};

// 推荐API - 综合协同过滤和原料规范化
router.get('/api/recommendations', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const MAX_RECOMMENDATIONS = 4;

    try {
        // 1) 获取用户交互数据（likes + favorites）
        const [userInteractions] = await dbPool.query(`
            SELECT 
                c.id, c.name, 'like' AS interaction_type, 
                c.estimated_abv AS abv, c.created_by AS creator,
                GROUP_CONCAT(DISTINCT i.name) AS ingredients
            FROM likes l
            JOIN cocktails c ON l.recipe_id = c.id
            JOIN ingredients i ON c.id = i.cocktail_id
            WHERE l.user_id = ?
            GROUP BY c.id
            UNION ALL
            SELECT 
                c.id, c.name, 'favorite' AS interaction_type, 
                c.estimated_abv AS abv, c.created_by AS creator,
                GROUP_CONCAT(DISTINCT i.name) AS ingredients
            FROM favorites f
            JOIN cocktails c ON f.recipe_id = c.id
            JOIN ingredients i ON c.id = i.cocktail_id
            WHERE f.user_id = ?
            GROUP BY c.id
        `, [userId, userId]);

        if (userInteractions.length === 0) {
            return res.json({
                recommendations: [],
                message: "您还没有点赞或收藏任何配方，无法生成推荐"
            });
        }

        // 2) 汇总用户偏好
        const preferenceData = {
            preferredAbv: 0,
            topCreators: new Map(),
            ingredientWeights: new Map(),
            interactedRecipeIds: new Set(),
            recipeIngredientWeights: new Map()
        };
        let totalAbv = 0, abvCount = 0;

        userInteractions.forEach(interaction => {
            preferenceData.interactedRecipeIds.add(interaction.id);

            if (interaction.abv !== null) {
                totalAbv += interaction.abv;
                abvCount++;
            }
            if (interaction.creator) {
                const cnt = preferenceData.topCreators.get(interaction.creator) || 0;
                preferenceData.topCreators.set(interaction.creator, cnt + 1);
            }
            if (interaction.ingredients) {
                const weight = interaction.interaction_type === 'favorite' ? 2 : 1;
                interaction.ingredients.split(',').forEach(rawIng => {
                    const ing = normalizeIngredient(rawIng);
                    const cur = preferenceData.ingredientWeights.get(ing) || 0;
                    preferenceData.ingredientWeights.set(ing, cur + weight);
                });
            }
            // 计算每个配方的原料权重和
            let recipeWeightSum = 0;
            if (interaction.ingredients) {
                interaction.ingredients.split(',').forEach(rawIng => {
                    const ing = normalizeIngredient(rawIng);
                    const weight = interaction.interaction_type === 'favorite' ? 2 : 1;
                    recipeWeightSum += weight;
                });
            }
            preferenceData.recipeIngredientWeights.set(interaction.id, recipeWeightSum);
        });

        // 计算中位数酒精度
        const abvList = [];
        userInteractions.forEach(interaction => {
            if (interaction.abv !== null) {
                abvList.push(interaction.abv);
            }
        });

        if (abvList.length > 0) {
            abvList.sort((a, b) => a - b);
            const mid = Math.floor(abvList.length / 2);
            if (abvList.length % 2 === 1) {
                preferenceData.preferredAbv = abvList[mid];
            } else {
                preferenceData.preferredAbv = (abvList[mid - 1] + abvList[mid]) / 2;
            }
        } else {
            preferenceData.preferredAbv = 0;
        }

        const sortedCreators = Array.from(preferenceData.topCreators.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(item => item[0]);

        const topIngredients = Array.from(preferenceData.ingredientWeights.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(item => item[0]);

        // 3) 协同过滤：找相似用户 & 相似用户喜欢的配方
        const similarUsers = new Map();
        if (preferenceData.interactedRecipeIds.size > 0) {
            const [potentialUsers] = await dbPool.query(`
                SELECT DISTINCT user_id AS userId
                FROM (
                    SELECT user_id, recipe_id FROM likes
                    UNION ALL
                    SELECT user_id, recipe_id FROM favorites
                ) AS interactions
                WHERE recipe_id IN (?)
                AND user_id != ?
            `, [Array.from(preferenceData.interactedRecipeIds), userId]);

            const [allInteractions] = await dbPool.query(`
                SELECT user_id AS userId, recipe_id AS recipeId
                FROM (
                    SELECT user_id, recipe_id FROM likes
                    UNION ALL
                    SELECT user_id, recipe_id FROM favorites
                ) AS interactions
                WHERE user_id IN (?)
            `, [potentialUsers.map(u => u.userId)]);

            const userInteractionMap = new Map();
            allInteractions.forEach(ia => {
                if (!userInteractionMap.has(ia.userId)) {
                    userInteractionMap.set(ia.userId, new Set());
                }
                userInteractionMap.get(ia.userId).add(ia.recipeId);
            });

            const currentUserSet = preferenceData.interactedRecipeIds;
            potentialUsers.forEach(user => {
                const otherUserSet = userInteractionMap.get(user.userId) || new Set();

                const intersection = new Set(
                    [...currentUserSet].filter(id => otherUserSet.has(id))
                );
                const union = new Set([...currentUserSet, ...otherUserSet]);

                const similarity = union.size > 0
                    ? intersection.size / union.size
                    : 0;

                if (similarity > 0.2) {
                    similarUsers.set(user.userId, similarity);
                }
            });
        }

        // 4) 拿到所有候选配方
        const [allRecipes] = await dbPool.query(`
            SELECT 
                c.id, c.name, c.estimated_abv AS estimatedAbv, c.created_by AS creator,
                COUNT(DISTINCT l.user_id) AS likeCount,
                COUNT(DISTINCT f.user_id) AS favoriteCount,
                GROUP_CONCAT(DISTINCT i.name) AS ingredients
            FROM cocktails c
            LEFT JOIN likes l ON c.id = l.recipe_id
            LEFT JOIN favorites f ON c.id = f.recipe_id
            JOIN ingredients i ON c.id = i.cocktail_id
            GROUP BY c.id
        `);

        // 5) 计算每个配方的各项得分
        const candidateRecipes = allRecipes
            .filter(r => !preferenceData.interactedRecipeIds.has(r.id));

        const scoredRecipes = [];

        const recipeIds = candidateRecipes.map(r => r.id);
        let recipePopularityMap = new Map();

        if (similarUsers.size > 0 && recipeIds.length > 0) {
            const [popularityResults] = await dbPool.query(`
                SELECT 
                    recipe_id AS recipeId,
                    COUNT(DISTINCT user_id) AS userCount
                FROM (
                    SELECT user_id, recipe_id FROM likes
                    UNION ALL
                    SELECT user_id, recipe_id FROM favorites
                ) AS interactions
                WHERE recipe_id IN (?)
                AND user_id IN (?)
                GROUP BY recipe_id
            `, [recipeIds, Array.from(similarUsers.keys())]);

            popularityResults.forEach(row => {
                recipePopularityMap.set(row.recipeId, row.userCount);
            });
        }

        let interactingUsersMap = new Map();
        if (similarUsers.size > 0 && recipeIds.length > 0) {
            const [interactingResults] = await dbPool.query(`
                SELECT 
                    recipe_id AS recipeId,
                    user_id AS userId
                FROM (
                    SELECT recipe_id, user_id FROM likes
                    UNION
                    SELECT recipe_id, user_id FROM favorites
                ) AS interactions
                WHERE recipe_id IN (?)
                AND user_id IN (?)
            `, [recipeIds, Array.from(similarUsers.keys())]);

            interactingResults.forEach(row => {
                if (!interactingUsersMap.has(row.recipeId)) {
                    interactingUsersMap.set(row.recipeId, []);
                }
                interactingUsersMap.get(row.recipeId).push(row.userId);
            });
        }

        const avgRecipeWeight = userInteractions.length > 0
            ? Array.from(preferenceData.recipeIngredientWeights.values())
                .reduce((sum, val) => sum + val, 0) / userInteractions.length
            : 1;

        for (const recipe of candidateRecipes) {
            const scores = {
                ingredientMatch: 0,
                creatorMatch: 0,
                abvMatch: 0,
                popularity: 0,
                similarUsers: 0
            };
            const matchReasons = [];

            // 5.1 原料匹配 (权重 4)
            if (recipe.ingredients) {
                const recipeIngredients = recipe.ingredients.split(',')
                    .map(raw => normalizeIngredient(raw));

                let rawIngredientScore = 0;
                recipeIngredients.forEach(ing => {
                    const w = preferenceData.ingredientWeights.get(ing) || 0;
                    rawIngredientScore += w;
                });

                const smoothFactor = 0.5;
                scores.ingredientMatch = 4 * (rawIngredientScore / (avgRecipeWeight + smoothFactor));
                scores.ingredientMatch = Math.min(scores.ingredientMatch, 4);

                const common = recipeIngredients.filter(ing =>
                    preferenceData.ingredientWeights.has(ing));
                if (common.length > 0) {
                    const display = common.slice(0, 3).join('、');
                    matchReasons.push(`可能喜欢的原料: ${display}${common.length > 3 ? '等' : ''}`);
                }
            }

            // 5.2 创建者匹配 (权重 3)
            if (recipe.creator && sortedCreators.includes(recipe.creator)) {
                scores.creatorMatch = 3;
                matchReasons.push(`可能喜欢的调酒师: ${recipe.creator}`);
            }

            // 5.3 酒精度匹配 (权重 2)
            if (preferenceData.preferredAbv > 0 && recipe.estimatedAbv > 0) {
                const diff = Math.abs(recipe.estimatedAbv - preferenceData.preferredAbv);
                scores.abvMatch = Math.max(0, 2 * (1 - diff / 20));
                if (scores.abvMatch > 1.0) {
                    matchReasons.push(`可能喜欢的酒精浓度: ${recipe.estimatedAbv}%`);
                }
            }

            // 5.4 人气 (权重 1.5)
            const totalInteractions = recipe.likeCount + recipe.favoriteCount;
            if (totalInteractions > 0) {
                scores.popularity = Math.min(1.5, 1.5 * Math.log1p(totalInteractions / 50));
                if (totalInteractions > 10) {
                    matchReasons.push(`热门配方 (已有${totalInteractions}次👍&⭐)`);
                }
            }

            // 5.5 协同过滤 (权重 2.5)
            if (similarUsers.size > 0) {
                const userCount = recipePopularityMap.get(recipe.id) || 0;

                let weightedScore = 0;
                if (userCount > 0) {
                    const userIds = interactingUsersMap.get(recipe.id) || [];
                    userIds.forEach(userId => {
                        const similarity = similarUsers.get(userId) || 0;
                        weightedScore += similarity;
                    });
                }

                const maxPossible = Array.from(similarUsers.values())
                    .reduce((sum, val) => sum + val, 0);

                scores.similarUsers = maxPossible > 0
                    ? 2.5 * (weightedScore / maxPossible)
                    : 0;

                if (scores.similarUsers > 1) {
                    if (scores.similarUsers > 2.25) {
                        matchReasons.push(`高度相似的用户都喜欢`);
                    } else if (scores.similarUsers > 1.75) {
                        matchReasons.push(`多个相似用户喜欢`);
                    } else {
                        matchReasons.push(`相似用户喜欢`);
                    }
                }
            }

            const totalScore =
                scores.ingredientMatch +
                scores.creatorMatch +
                scores.abvMatch +
                scores.popularity +
                scores.similarUsers;

            scoredRecipes.push({
                ...recipe,
                scores,
                totalScore,
                matchReasons
            });
        }

        // 6) 排序 & 取前 MAX_RECOMMENDATIONS 个
        const recommendations = scoredRecipes
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, MAX_RECOMMENDATIONS)
            .map(recipe => {
                const maxPossibleScore = 4 + 3 + 2 + 1.5 + 2.5;
                const matchPercentage = Math.min(
                    100,
                    Math.round((recipe.totalScore / maxPossibleScore) * 100)
                );

                const scoreItems = [
                    {
                        type: "ingredient",
                        weight: 4,
                        reason: recipe.matchReasons.find(r => r.includes("原料")),
                        scoreRate: recipe.scores.ingredientMatch / 4
                    },
                    {
                        type: "creator",
                        weight: 3,
                        reason: recipe.matchReasons.find(r => r.includes("调酒师")),
                        scoreRate: recipe.scores.creatorMatch / 3
                    },
                    {
                        type: "collaborative",
                        weight: 2.5,
                        reason: recipe.matchReasons.find(r => r.includes("相似的用户")),
                        scoreRate: recipe.scores.similarUsers / 2.5
                    },
                    {
                        type: "abv",
                        weight: 2,
                        reason: recipe.matchReasons.find(r => r.includes("酒精浓度")),
                        scoreRate: recipe.scores.abvMatch / 2
                    },
                    {
                        type: "popularity",
                        weight: 1.5,
                        reason: recipe.matchReasons.find(r => r.includes("热门配方")),
                        scoreRate: recipe.scores.popularity / 1.5
                    }
                ];

                const sortedScoreItems = scoreItems
                    .filter(item => item.reason)
                    .sort((a, b) => b.scoreRate - a.scoreRate);

                let reasons = [];
                for (const item of sortedScoreItems) {
                    if (reasons.length < 3 && item.scoreRate > 0.5) {
                        reasons.push(item.reason);
                    }
                }
                if (reasons.length === 0 && recipe.matchReasons.length > 0) {
                    reasons = recipe.matchReasons.slice(0, 3);
                } else if (reasons.length === 0) {
                    reasons = ["您可能喜欢的新配方"];
                }
                const reasonText = reasons.join(" • ");

                return {
                    id: recipe.id,
                    name: recipe.name,
                    estimatedAbv: recipe.estimatedAbv,
                    matchPercentage,
                    reason: reasonText,
                    reasons: reasons
                };
            });

        return res.json({ recommendations });

    } catch (error) {
        console.error("生成推荐失败:", error);
        return res.status(500).json({
            message: "生成推荐时出错",
            error: error.message
        });
    }
});

module.exports = router;
