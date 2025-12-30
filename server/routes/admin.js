const express = require('express');
const router = express.Router();
const dbPool = require('../config/db'); // 引入数据库连接
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middleware/auth'); // 引入中间件

// 项目根目录 (server 的上级目录)
const ROOT_DIR = path.join(__dirname, '..', '..');

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
    try {
        // 先检查数据库中是否存在该配方
        const [recipes] = await dbPool.query('SELECT * FROM cocktails WHERE id = ?', [recipeIdToDelete]);
        if (recipes.length === 0) {
            return res.status(404).json({ message: '未找到要删除的配方' });
        }
        // 删除配方
        await dbPool.query('DELETE FROM cocktails WHERE id = ?', [recipeIdToDelete]);
        // 可选：同时删除相关的 ingredients、评论等
        await dbPool.query('DELETE FROM ingredients WHERE cocktail_id = ?', [recipeIdToDelete]);
        await dbPool.query('DELETE FROM comment WHERE thread_id = ?', [recipeIdToDelete]);
        res.status(200).json({ message: '配方删除成功' });
    } catch (error) {
        console.error(`Error deleting recipe ${recipeIdToDelete}:`, error);
        res.status(500).json({ message: '删除配方时出错' });
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
    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE id = ?', [userIdToDelete]);
        if (users.length === 0) {
            return res.status(404).json({ message: '未找到要删除的用户' });
        }
        await dbPool.query('DELETE FROM users WHERE id = ?', [userIdToDelete]);
        res.status(200).json({ message: '用户删除成功' });
    } catch (error) {
        console.error(`Error deleting user ${userIdToDelete}:`, error);
        res.status(500).json({ message: '删除用户时出错' });
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