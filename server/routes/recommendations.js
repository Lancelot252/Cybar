const express = require('express');
const router = express.Router();
const dbPool = require('../config/db');

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;
const LIKE_WEIGHT = 1;
const FAVORITE_WEIGHT = 2;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseLimit(rawLimit) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_LIMIT;
    }
    return Math.min(parsed, MAX_LIMIT);
}

function compareByScoreThenCreatedAt(a, b) {
    if (b.score !== a.score) {
        return b.score - a.score;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function buildRecommendationReason(creatorAffinity, abvAffinity, randomBonus) {
    if (creatorAffinity >= 0.66) {
        return '与你常点赞/收藏的创作者相符';
    }
    if (abvAffinity >= 0.66) {
        return '酒精度接近你的偏好';
    }
    if (randomBonus >= 15) {
        return '随机探索推荐';
    }
    return '综合偏好推荐';
}

async function fetchAllRecipeCandidates() {
    const [rows] = await dbPool.query(`
        SELECT
            c.id,
            c.name,
            c.estimated_abv AS estimatedAbv,
            c.image,
            c.created_by AS createdBy,
            c.created_at AS createdAt,
            COUNT(DISTINCT l.user_id) AS likeCount,
            COUNT(DISTINCT f.user_id) AS favoriteCount
        FROM cocktails c
        LEFT JOIN likes l ON c.id = l.recipe_id
        LEFT JOIN favorites f ON c.id = f.recipe_id
        GROUP BY c.id, c.name, c.estimated_abv, c.image, c.created_by, c.created_at
    `);

    return rows.map(row => ({
        id: row.id,
        name: row.name,
        estimatedAbv: toNumberOrNull(row.estimatedAbv),
        image: row.image || null,
        createdBy: row.createdBy || null,
        createdAt: row.createdAt,
        likeCount: Number(row.likeCount) || 0,
        favoriteCount: Number(row.favoriteCount) || 0
    }));
}

async function buildUserBehaviorProfile(userId) {
    const [rows] = await dbPool.query(`
        SELECT
            i.recipeId,
            MAX(i.weight) AS weight,
            MAX(i.estimatedAbv) AS estimatedAbv,
            MAX(i.createdBy) AS createdBy
        FROM (
            SELECT
                l.recipe_id AS recipeId,
                ? AS weight,
                c.estimated_abv AS estimatedAbv,
                c.created_by AS createdBy
            FROM likes l
            JOIN cocktails c ON c.id = l.recipe_id
            WHERE l.user_id = ?

            UNION ALL

            SELECT
                f.recipe_id AS recipeId,
                ? AS weight,
                c.estimated_abv AS estimatedAbv,
                c.created_by AS createdBy
            FROM favorites f
            JOIN cocktails c ON c.id = f.recipe_id
            WHERE f.user_id = ?
        ) AS i
        GROUP BY i.recipeId
    `, [LIKE_WEIGHT, userId, FAVORITE_WEIGHT, userId]);

    const interactedRecipeIds = new Set();
    const creatorWeightMap = new Map();

    let weightedAbvSum = 0;
    let weightedAbvCount = 0;

    for (const row of rows) {
        interactedRecipeIds.add(row.recipeId);

        const weight = Number(row.weight) || 0;
        const estimatedAbv = toNumberOrNull(row.estimatedAbv);
        const createdBy = row.createdBy;

        if (estimatedAbv !== null) {
            weightedAbvSum += estimatedAbv * weight;
            weightedAbvCount += weight;
        }

        if (createdBy) {
            const current = creatorWeightMap.get(createdBy) || 0;
            creatorWeightMap.set(createdBy, current + weight);
        }
    }

    const preferredAbv = weightedAbvCount > 0 ? (weightedAbvSum / weightedAbvCount) : null;
    const maxCreatorWeight = creatorWeightMap.size > 0
        ? Math.max(...creatorWeightMap.values())
        : 0;

    return {
        hasData: interactedRecipeIds.size > 0,
        preferredAbv,
        interactedRecipeIds,
        creatorWeightMap,
        maxCreatorWeight
    };
}

function toRecommendationResponse(item, reason, randomBonus, score, isRecall = false) {
    return {
        id: item.id,
        name: item.name,
        estimatedAbv: item.estimatedAbv,
        image: item.image,
        createdBy: item.createdBy,
        likeCount: item.likeCount,
        favoriteCount: item.favoriteCount,
        score,
        randomBonus,
        isRecall,
        reason,
        matchPercentage: null
    };
}

function buildPopularRandomRecommendations(recipes, limit, session) {
    const noiseMap = session.recommendationNoiseMap || {};

    const ranked = recipes.map(recipe => {
        if (!Number.isFinite(noiseMap[recipe.id])) {
            noiseMap[recipe.id] = randomInt(0, 50);
        }

        const randomBonus = Number(noiseMap[recipe.id]) || 0;
        const score = recipe.likeCount + recipe.favoriteCount + randomBonus;

        return {
            ...recipe,
            randomBonus,
            score
        };
    });

    ranked.sort(compareByScoreThenCreatedAt);
    session.recommendationNoiseMap = noiseMap;

    return ranked.slice(0, limit).map(item => (
        toRecommendationResponse(item, '热门与随机推荐', item.randomBonus, item.score, false)
    ));
}

function buildPersonalizedRecommendations(recipes, limit, profile) {
    const recallCap = Math.ceil(limit * 0.2);

    const scored = recipes.map(recipe => {
        const isRecall = profile.interactedRecipeIds.has(recipe.id);

        let abvAffinity = 0.5;
        if (profile.preferredAbv !== null && recipe.estimatedAbv !== null) {
            abvAffinity = Math.max(0, 1 - Math.abs(recipe.estimatedAbv - profile.preferredAbv) / 30);
        }

        let creatorAffinity = 0;
        if (profile.maxCreatorWeight > 0 && profile.creatorWeightMap.has(recipe.createdBy)) {
            const creatorWeight = profile.creatorWeightMap.get(recipe.createdBy);
            creatorAffinity = creatorWeight / profile.maxCreatorWeight;
        }

        const baseScore = (abvAffinity * 70) + (creatorAffinity * 30);
        const randomBonus = randomInt(0, 20);
        const score = Number((baseScore + randomBonus).toFixed(4));
        const reason = buildRecommendationReason(creatorAffinity, abvAffinity, randomBonus);

        return {
            ...recipe,
            isRecall,
            abvAffinity,
            creatorAffinity,
            randomBonus,
            score,
            reason
        };
    });

    scored.sort(compareByScoreThenCreatedAt);

    const selected = [];
    const selectedIds = new Set();
    let recallUsed = 0;

    for (const item of scored) {
        if (item.isRecall && recallUsed >= recallCap) {
            continue;
        }

        selected.push(item);
        selectedIds.add(item.id);

        if (item.isRecall) {
            recallUsed += 1;
        }

        if (selected.length >= limit) {
            break;
        }
    }

    if (selected.length < limit) {
        for (const item of scored) {
            if (selectedIds.has(item.id)) {
                continue;
            }

            selected.push(item);
            selectedIds.add(item.id);

            if (selected.length >= limit) {
                break;
            }
        }
    }

    return selected.map(item => (
        toRecommendationResponse(
            item,
            item.reason,
            item.randomBonus,
            item.score,
            item.isRecall
        )
    ));
}

router.get('/api/recommendations', async (req, res) => {
    const limit = parseLimit(req.query.limit);
    const userId = req.session?.userId;

    try {
        const recipes = await fetchAllRecipeCandidates();

        if (recipes.length === 0) {
            return res.json({
                strategy: 'popular_random',
                recommendations: []
            });
        }

        if (!userId) {
            return res.json({
                strategy: 'popular_random',
                recommendations: buildPopularRandomRecommendations(recipes, limit, req.session)
            });
        }

        const profile = await buildUserBehaviorProfile(userId);

        if (!profile.hasData) {
            return res.json({
                strategy: 'popular_random',
                recommendations: buildPopularRandomRecommendations(recipes, limit, req.session)
            });
        }

        return res.json({
            strategy: 'personalized_v2',
            recommendations: buildPersonalizedRecommendations(recipes, limit, profile)
        });
    } catch (error) {
        console.error('生成推荐失败:', error);
        return res.status(500).json({
            message: '生成推荐时出错',
            error: error.message
        });
    }
});

module.exports = router;
