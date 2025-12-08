const express = require('express');
const router = express.Router();
const dbPool = require('../config/db');
const path = require('path');
const { isAuthenticated } = require('../middleware/auth');

// 项目根目录 (server 的上级目录)
const ROOT_DIR = path.join(__dirname, '..', '..');

// --- Page Routes ---
router.get('/profile/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'profile', 'index.html'));
});

// --- User Profile API Routes ---

// 获取当前用户信息
router.get('/api/user/current', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const [rows] = await dbPool.query(
            `SELECT id, username, role FROM users WHERE id = ?`, [userId]
        );
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: '用户不存在' });
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ message: '获取用户信息失败' });
    }
});

// 获取当前用户点赞的配方
router.get('/api/user/likes', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const [rows] = await dbPool.query(
            `SELECT c.id, c.name, c.created_by AS createdBy, c.estimated_abv AS estimatedAbv
             FROM likes l
             JOIN cocktails c ON l.recipe_id = c.id
             WHERE l.user_id = ?`, [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching user likes:', error);
        res.status(500).json({ message: '获取点赞历史失败' });
    }
});

// 获取当前用户收藏的配方
router.get('/api/user/favorites', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const [rows] = await dbPool.query(
            `SELECT c.id, c.name, c.created_by AS createdBy, c.estimated_abv AS estimatedAbv
             FROM favorites f
             JOIN cocktails c ON f.recipe_id = c.id
             WHERE f.user_id = ?`, [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching user favorites:', error);
        res.status(500).json({ message: '获取收藏历史失败' });
    }
});

// 获取当前用户创建的配方
router.get('/api/user/created-recipes', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.username;
        const [rows] = await dbPool.query(
            `SELECT id, name, created_by AS createdBy, instructions, estimated_abv AS estimatedAbv
             FROM cocktails
             WHERE created_by = ?`, [username]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching user created recipes:', error);
        res.status(500).json({ message: '获取创建配方历史失败' });
    }
});

// 更新用户个人资料
router.put('/api/user/profile', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { nickname, bio } = req.body;

    if (!nickname) {
        return res.status(400).json({ message: '昵称不能为空' });
    }

    try {
        // 检查昵称是否已被其他用户使用
        const [existing] = await dbPool.query(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [nickname, userId]
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: '该昵称已被使用' });
        }

        // 更新用户名 (数据库中没有 bio 字段，暂时忽略 bio)
        await dbPool.query(
            'UPDATE users SET username = ? WHERE id = ?',
            [nickname, userId]
        );

        // 更新 Session 中的用户名
        req.session.username = nickname;

        res.json({ 
            message: '个人资料已更新', 
            username: nickname
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: '更新个人资料失败' });
    }
});


module.exports = router;
