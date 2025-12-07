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

module.exports = router;
