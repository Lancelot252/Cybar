const express = require('express');
const router = express.Router();
const dbPool = require('../config/db');
const path = require('path');
const { isAuthenticated } = require('../middleware/auth');

// 项目根目录 (server 的上级目录)
const ROOT_DIR = path.join(__dirname, '..', '..');

// --- Page Routes ---
router.get('/recipes/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'recipes', 'index.html'));
});

router.get('/calculator/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'calculator', 'index.html'));
});

// --- API Routes ---

// API to get recipes with pagination & sorting
router.get('/api/recipes', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search ? req.query.search.trim() : '';
    const sort = req.query.sort || 'default';
    const offset = (page - 1) * limit;

    let where = '';
    let params = [];
    let orderBy = '';

    if (search) {
        where = 'WHERE name LIKE ?';
        params.push(`%${search}%`);
    }

    // 根据排序类型确定ORDER BY子句
    switch (sort) {
        case 'likes':
            orderBy = 'ORDER BY likeCount DESC, c.created_at DESC';
            break;
        case 'favorites':
            orderBy = 'ORDER BY favoriteCount DESC, c.created_at DESC';
            break;
        case 'name':
            orderBy = 'ORDER BY c.name ASC';
            break;
        case 'default':
        default:
            orderBy = 'ORDER BY c.created_at DESC';
            break;
    }

    try {
        // 查询总数
        const countSql = `SELECT COUNT(*) AS total FROM cocktails ${where}`;
        const [[{ total }]] = await dbPool.query(countSql, params);

        // 查询当前页数据
        const dataSql = `
            SELECT
                c.id,
                c.name,
                c.created_by AS createdBy,
                c.instructions,
                c.estimated_abv AS estimatedAbv,
                (SELECT COUNT(*) FROM likes WHERE recipe_id = c.id) AS likeCount,
                (SELECT COUNT(*) FROM favorites WHERE recipe_id = c.id) AS favoriteCount,
                GROUP_CONCAT(DISTINCT i.name) AS ingredients
            FROM cocktails c
            LEFT JOIN likes l ON c.id = l.recipe_id
            LEFT JOIN favorites f ON c.id = f.recipe_id
            LEFT JOIN ingredients i ON c.id = i.cocktail_id
            ${where}
            GROUP BY c.id
            ${orderBy}
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const [recipes] = await dbPool.query(dataSql, params);

        res.json({
            recipes: recipes.map(r => ({
                ...r,
                estimatedAbv: Number(r.estimatedAbv)
            })),
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            sortBy: sort
        });
    } catch (error) {
        console.error("读取配方时出错:", error);
        res.status(500).json({ message: '读取配方时出错' });
    }
});

// API to get single recipe detail
router.get('/api/recipes/:id', async (req, res) => {
    const recipeId = req.params.id;
    try {
        const [recipes] = await dbPool.query(
            `SELECT c.id, c.name, c.instructions, c.estimated_abv AS estimatedAbv, 
                    c.created_by AS createdBy, 
                    (SELECT COUNT(*) FROM likes WHERE recipe_id = c.id) AS likeCount, 
                    (SELECT COUNT(*) FROM favorites WHERE recipe_id = c.id) AS favoriteCount 
             FROM cocktails c WHERE c.id = ?`, [recipeId]
        );
        if (recipes.length === 0) {
            console.warn(`Recipe with ID ${recipeId} not found.`);
            return res.status(404).json({ message: '未找到配方' });
        }
        // 查询原料表
        const [ingredients] = await dbPool.query(
            'SELECT id, cocktail_id, name, volume, abv FROM ingredients WHERE cocktail_id = ?', [recipeId]
        );
        res.json({
            ...recipes[0],
            ingredients
        });
    } catch (error) {
        console.error(`获取配方详情时出错 for recipeId ${recipeId}:`, error);
        res.status(500).json({ message: '获取配方详情时出错' });
    }
});

// API to get comments for a recipe
router.get('/api/recipes/:id/comments', async (req, res) => {
    const recipeId = req.params.id;
    try {
        const [rows] = await dbPool.query(
            `SELECT id, user_id, username, text, timestamp FROM comment WHERE thread_id = ? ORDER BY timestamp DESC`, [recipeId]
        );
        res.json(rows);
    } catch (error) {
        console.error("获取评论时出错:", error);
        res.status(500).json({ message: '无法加载评论' });
    }
});

// API to add a comment to a recipe (Protected)
router.post('/api/recipes/:id/comments', isAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const { commentText } = req.body;
    const userId = req.session.userId;
    const username = req.session.username;

    if (!userId) {
        return res.status(401).json({ message: '请先登录' });
    }

    if (!commentText || commentText.trim() === '') {
        return res.status(400).json({ message: '评论内容不能为空' });
    }

    try {
        const commentId = Date.now().toString() + Math.floor(Math.random() * 1000);
        await dbPool.query(
            `INSERT INTO comment (id, thread_id, user_id, username, text, timestamp) VALUES (?, ?, ?, ?, ?, NOW())`,
            [commentId, recipeId, userId, username, commentText.trim()]
        );
        const [rows] = await dbPool.query(
            `SELECT id, user_id, username, text, timestamp FROM comment WHERE id = ?`, [commentId]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error inserting comment:', error);
        res.status(500).json({ message: '提交评论时发生错误' });
    }
});

// API to add new recipe
router.post('/api/recipes', isAuthenticated, async (req, res) => {
    const newRecipe = req.body;
    const creatorUsername = req.session.username;

    if (!newRecipe || !newRecipe.name) {
        return res.status(400).json({ message: '无效的配方数据' });
    }
    if (!creatorUsername) {
        return res.status(401).json({ message: '无法确定创建者，请重新登录' });
    }

    try {
        const recipeId = Date.now().toString();
        await dbPool.query(
            `INSERT INTO cocktails (id, name, created_by, instructions, estimated_abv)
             VALUES (?, ?, ?, ?, ?)`,
            [
                recipeId,
                newRecipe.name,
                creatorUsername,
                newRecipe.instructions || '',
                newRecipe.estimatedAbv || 0,
            ]
        );
        res.status(201).json({ message: '配方添加成功', recipe: { id: recipeId, ...newRecipe, createdBy: creatorUsername } });
    } catch (error) {
        console.error("Error adding recipe:", error);
        res.status(500).json({ message: '无法添加配方' });
    }
});

// API to toggle like on a recipe
router.post('/api/recipes/:id/like', isAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.userId;

    try {
        const [rows] = await dbPool.query(
            'SELECT * FROM likes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]
        );
        if (rows.length === 0) {
            const likeId = Date.now().toString() + Math.floor(Math.random() * 1000);
            await dbPool.query('INSERT INTO likes (id, user_id, recipe_id) VALUES (?, ?, ?)', [likeId, userId, recipeId]);
        } else {
            await dbPool.query('DELETE FROM likes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]);
        }

        const [[{ likeCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS likeCount FROM likes WHERE recipe_id = ?', [recipeId]
        );
        const [[{ favoriteCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS favoriteCount FROM favorites WHERE recipe_id = ?', [recipeId]
        );

        res.json({
            success: true,
            isLiked: rows.length === 0,
            likeCount,
            favoriteCount
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ message: '操作失败' });
    }
});

// API to toggle favorite on a recipe
router.post('/api/recipes/:id/favorite', isAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.userId;

    try {
        const [rows] = await dbPool.query(
            'SELECT * FROM favorites WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]
        );
        if (rows.length === 0) {
            const favId = Date.now().toString() + Math.floor(Math.random() * 1000);
            await dbPool.query('INSERT INTO favorites (id, user_id, recipe_id) VALUES (?, ?, ?)', [favId, userId, recipeId]);
        } else {
            await dbPool.query('DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]);
        }

        const [[{ likeCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS likeCount FROM likes WHERE recipe_id = ?', [recipeId]
        );
        const [[{ favoriteCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS favoriteCount FROM favorites WHERE recipe_id = ?', [recipeId]
        );

        res.json({
            success: true,
            isFavorited: rows.length === 0,
            likeCount,
            favoriteCount
        });
    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({ message: '操作失败' });
    }
});

// API to get like and favorite status for a recipe
router.get('/api/recipes/:id/interactions', isAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.userId;

    try {
        const [[{ likeCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS likeCount FROM likes WHERE recipe_id = ?', [recipeId]
        );
        const [[{ favoriteCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS favoriteCount FROM favorites WHERE recipe_id = ?', [recipeId]
        );
        const [liked] = await dbPool.query(
            'SELECT 1 FROM likes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]
        );
        const [favorited] = await dbPool.query(
            'SELECT 1 FROM favorites WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]
        );
        res.json({
            likeCount,
            favoriteCount,
            isLiked: liked.length > 0,
            isFavorited: favorited.length > 0
        });
    } catch (error) {
        console.error(`Error getting interactions for recipe ${recipeId}:`, error);
        res.status(500).json({ message: '无法加载交互状态' });
    }
});

module.exports = router;
