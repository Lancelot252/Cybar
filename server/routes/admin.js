const express = require('express');
const router = express.Router();
const dbPool = require('../config/db'); // 引入数据库连接
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middleware/auth'); // 引入中间件

// 项目根目录 (server 的上级目录)
const ROOT_DIR = path.join(__dirname, '..', '..');

// 统一清洗批量操作传入的 ID 列表
function normalizeIds(ids) {
    if (!Array.isArray(ids)) return [];
    return Array.from(
        new Set(
            ids
                .map(id => String(id || '').trim())
                .filter(Boolean)
        )
    );
}

async function deleteRecipesByIds(connection, recipeIds) {
    if (!recipeIds.length) return;
    await connection.query('DELETE FROM ingredients WHERE cocktail_id IN (?)', [recipeIds]);
    await connection.query('DELETE FROM comment WHERE thread_id IN (?)', [recipeIds]);
    await connection.query('DELETE FROM likes WHERE recipe_id IN (?)', [recipeIds]);
    await connection.query('DELETE FROM favorites WHERE recipe_id IN (?)', [recipeIds]);
    await connection.query('DELETE FROM cocktails WHERE id IN (?)', [recipeIds]);
}

async function deleteUsersByIds(connection, userIds) {
    if (!userIds.length) return;
    await connection.query('DELETE FROM comment WHERE user_id IN (?)', [userIds]);
    await connection.query('DELETE FROM likes WHERE user_id IN (?)', [userIds]);
    await connection.query('DELETE FROM favorites WHERE user_id IN (?)', [userIds]);
    await connection.query('DELETE FROM users WHERE id IN (?)', [userIds]);
}

// 页面访问计数（临时存储，后续可迁移到独立模块）
const pageVisitCounts = {
    '/': 0,
    '/recipes/': 0,
    '/calculator/': 0,
    '/admin/': 0,
};

// 导出访问计数供其他模块使用
router.getVisitCounts = () => pageVisitCounts;

// --- Admin Page Route ---
router.get('/admin/', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'admin', 'index.html'));
});

// --- Admin API Routes (Require isAdmin) ---

// API to DELETE a recipe
router.delete('/api/recipes/:id', isAuthenticated, isAdmin, async (req, res) => {
    const recipeIdToDelete = req.params.id;
    let connection;
    try {
        // 先检查数据库中是否存在该配方
        const [recipes] = await dbPool.query('SELECT * FROM cocktails WHERE id = ?', [recipeIdToDelete]);
        if (recipes.length === 0) {
            return res.status(404).json({ message: '未找到要删除的配方' });
        }
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        await deleteRecipesByIds(connection, [recipeIdToDelete]);
        await connection.commit();
        res.status(200).json({ message: '配方删除成功' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error(`Error deleting recipe ${recipeIdToDelete}:`, error);
        res.status(500).json({ message: '删除配方时出错' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// API to batch DELETE recipes
router.delete('/api/admin/recipes/batch-delete', isAuthenticated, isAdmin, async (req, res) => {
    const recipeIds = normalizeIds(req.body?.ids);
    if (!recipeIds.length) {
        return res.status(400).json({ message: '请先选择要删除的配方' });
    }

    try {
        const [existingRows] = await dbPool.query('SELECT id FROM cocktails WHERE id IN (?)', [recipeIds]);
        const existingIds = existingRows.map(item => String(item.id));
        if (!existingIds.length) {
            return res.status(404).json({ message: '未找到可删除的配方' });
        }

        const connection = await dbPool.getConnection();
        try {
            await connection.beginTransaction();
            await deleteRecipesByIds(connection, existingIds);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        res.status(200).json({
            message: `配方批量删除成功，共 ${existingIds.length} 条`,
            deletedCount: existingIds.length,
            deletedIds: existingIds,
            missingCount: Math.max(recipeIds.length - existingIds.length, 0)
        });
    } catch (error) {
        console.error('Error batch deleting recipes:', error);
        res.status(500).json({ message: '批量删除配方时出错' });
    }
});

// API to get admin statistics
router.get('/api/admin/stats', isAuthenticated, isAdmin, async (req, res) => { // Add isAdmin middleware
    const stats = {
        totalRecipes: 0,
        visits: pageVisitCounts,
        totalUsers: 0
    };
    try {
        const [[{ totalRecipes }]] = await dbPool.query('SELECT COUNT(*) AS totalRecipes FROM cocktails');
        const [[{ totalUsers }]] = await dbPool.query('SELECT COUNT(*) AS totalUsers FROM users');
        stats.totalRecipes = totalRecipes;
        stats.totalUsers = totalUsers;
        res.json(stats);
    } catch (error) {
        console.error("Error reading stats from DB:", error);
        res.json(stats);
    }
});

// --- New API Route to get all users (Admin only - MODIFIED FOR PAGINATION) ---
router.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    try {
        const [users] = await dbPool.query(
            'SELECT id, username, role, avatar FROM users LIMIT ? OFFSET ?', [limit, offset]
        );
        const [[{ total }]] = await dbPool.query('SELECT COUNT(*) AS total FROM users');
        res.json({
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            users
        });
    } catch (error) {
        res.status(500).json({ message: '无法加载用户信息' });
    }
});

// API Route to get full user detail (Admin only, includes password as requested)
router.get('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.userId;
    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!users.length) {
            return res.status(404).json({ message: '未找到该用户' });
        }
        res.json({ user: users[0] });
    } catch (error) {
        console.error(`Error loading user detail for ${userId}:`, error);
        res.status(500).json({ message: '无法加载用户详情' });
    }
});

// --- New API Route to get ALL comments (Admin only - MODIFIED FOR PAGINATION) ---
router.get('/api/admin/comments', isAuthenticated, isAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    const recipeId = (req.query.recipeId || '').trim();
    const userQuery = (req.query.userQuery || '').trim(); // 可为 user_id 或 username

    // 动态构建 WHERE 条件
    let whereClauses = [];
    let params = [];
    if (recipeId) {
        whereClauses.push('thread_id = ?');
        params.push(recipeId);
    }
    if (userQuery) {
        // 同时匹配 user_id 精确或 username 精确 / 模糊，可按需调整
        whereClauses.push('(user_id = ? OR username = ?)');
        params.push(userQuery, userQuery);
    }
    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    try {
        // 查询总评论数（带筛选）
        const countSql = `SELECT COUNT(*) AS total FROM comment ${whereSql}`;
        const [[{ total }]] = await dbPool.query(countSql, params);

        // 查询当前页评论（带筛选）JOIN 酒单表获取酒名
        const dataSql = `
            SELECT 
                comment.id, 
                comment.thread_id AS recipeId, 
                cocktails.name AS recipeName,
                comment.user_id, 
                comment.username, 
                comment.text, 
                comment.timestamp
            FROM comment
            LEFT JOIN cocktails ON comment.thread_id = cocktails.id
            ${whereSql}
            ORDER BY comment.timestamp DESC
            LIMIT ? OFFSET ?`;
        const dataParams = params.concat([limit, offset]);
        const [comments] = await dbPool.query(dataSql, dataParams);

        res.json({
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            comments,
            filter: {
                recipeId: recipeId || null,
                userQuery: userQuery || null
            }
        });
    } catch (error) {
        console.error('Error reading comments for admin (with filters):', error);
        res.status(500).json({ message: '无法加载评论信息' });
    }
});

// --- New API Route to DELETE a comment (Admin only) ---
// Ensure this route is already protected by isAuthenticated and isAdmin
router.delete('/api/comments/:commentId', isAuthenticated, isAdmin, async (req, res) => {
    const commentIdToDelete = req.params.commentId;
    const adminUsername = req.session.username;
    console.log(`Admin '${adminUsername}' attempting to delete comment ID: ${commentIdToDelete}`);

    try {
        // 检查数据库中是否存在该评论
        const [comments] = await dbPool.query('SELECT * FROM comment WHERE id = ?', [commentIdToDelete]);
        if (comments.length === 0) {
            return res.status(404).json({ message: '未找到要删除的评论' });
        }
        // 删除评论
        await dbPool.query('DELETE FROM comment WHERE id = ?', [commentIdToDelete]);
        console.log(`Admin '${adminUsername}' successfully deleted comment ${commentIdToDelete}`);
        res.status(200).json({ message: '评论删除成功' });
    } catch (error) {
        console.error(`Error during deletion of comment ${commentIdToDelete} by admin '${adminUsername}':`, error);
        res.status(500).json({ message: '删除评论时发生服务器内部错误' });
    }
});

// --- User Management API Routes (Now require isAdmin) ---

// API Route to DELETE a user (Requires Admin)
router.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
    const userIdToDelete = req.params.userId;
    const adminUserId = req.session.userId;
    if (userIdToDelete == adminUserId) {
        return res.status(400).json({ message: '无法删除自己的账户' });
    }
    let connection;
    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE id = ?', [userIdToDelete]);
        if (users.length === 0) {
            return res.status(404).json({ message: '未找到要删除的用户' });
        }
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        await deleteUsersByIds(connection, [userIdToDelete]);
        await connection.commit();
        res.status(200).json({ message: '用户删除成功' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error(`Error deleting user ${userIdToDelete}:`, error);
        res.status(500).json({ message: '删除用户时出错' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// API Route to batch DELETE users (Requires Admin)
router.delete('/api/admin/users/batch/delete', isAuthenticated, isAdmin, async (req, res) => {
    const userIds = normalizeIds(req.body?.ids);
    const adminUserId = String(req.session.userId || '');

    if (!userIds.length) {
        return res.status(400).json({ message: '请先选择要删除的用户' });
    }
    if (userIds.includes(adminUserId)) {
        return res.status(400).json({ message: '批量删除中包含当前登录账号，已阻止操作' });
    }

    try {
        const [existingRows] = await dbPool.query('SELECT id FROM users WHERE id IN (?)', [userIds]);
        const existingIds = existingRows.map(item => String(item.id));
        if (!existingIds.length) {
            return res.status(404).json({ message: '未找到可删除的用户' });
        }

        const connection = await dbPool.getConnection();
        try {
            await connection.beginTransaction();
            await deleteUsersByIds(connection, existingIds);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        res.status(200).json({
            message: `用户批量删除成功，共 ${existingIds.length} 条`,
            deletedCount: existingIds.length,
            deletedIds: existingIds,
            missingCount: Math.max(userIds.length - existingIds.length, 0)
        });
    } catch (error) {
        console.error('Error batch deleting users:', error);
        res.status(500).json({ message: '批量删除用户时出错' });
    }
});

// API Route to update a user's role (Requires Admin)
router.put('/api/admin/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
    const userIdToUpdate = req.params.userId;
    const { newRole } = req.body;
    const adminUserId = req.session.userId;
    const validRoles = ['user', 'admin'];
    if (!newRole || !validRoles.includes(newRole)) {
        return res.status(400).json({ message: `无效的角色。有效角色: ${validRoles.join(', ')}` });
    }
    if (userIdToUpdate === adminUserId && newRole !== 'admin') {
        return res.status(400).json({ message: '无法降低自己的管理员权限' });
    }
    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE id = ?', [userIdToUpdate]);
        if (users.length === 0) {
            return res.status(404).json({ message: '未找到要修改的用户' });
        }
        await dbPool.query('UPDATE users SET role = ? WHERE id = ?', [newRole, userIdToUpdate]);
        res.status(200).json({ message: '用户角色修改成功' });
    } catch (error) {
        console.error(`Error updating role for user ${userIdToUpdate}:`, error);
        res.status(500).json({ message: '修改用户角色时出错' });
    }
});

module.exports = router;
