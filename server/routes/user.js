const express = require('express');
const router = express.Router();
const dbPool = require('../config/db');
const path = require('path');
const { isAuthenticated } = require('../middleware/auth');
const { createImageUpload, persistImage } = require('../services/imageUpload');

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..', '..');

// --- 配置 Multer (图片存储策略) ---
const upload = createImageUpload('avatar');
const AVATAR_DIR = path.join(ROOT_DIR, 'uploads', 'avatars');

// --- 路由 ---

// 页面路由
router.get('/profile/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'profile', 'index.html'));
});

router.get('/profile/settings/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'profile', 'settings.html'));
});
router.get('/profile/index.html', isAuthenticated, (req, res) => res.sendFile(path.join(ROOT_DIR, 'profile', 'index.html')));
router.get('/profile/settings.html', isAuthenticated, (req, res) => res.sendFile(path.join(ROOT_DIR, 'profile', 'settings.html')));

// [修改] 获取当前用户信息 (增加了 avatar 和 signature)
router.get('/api/user/current', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        // 👇 注意这里加了 signature
        const [rows] = await dbPool.query(
            `SELECT id, username, role, avatar, signature FROM users WHERE id = ?`, [userId]
        );
        if (rows.length > 0) {
            if (!rows[0].avatar) {
                rows[0].avatar = '/uploads/avatars/test.jpg'; 
            }
            // 如果签名为空，给个默认提示（可选，或者前端处理）
            if (!rows[0].signature) {
                rows[0].signature = '还没有签名哦'; 
            }
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: '用户不存在' });
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ message: '获取用户信息失败' });
    }
});

// API: 头像上传接口
router.post('/api/user/avatar', isAuthenticated, upload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '请选择一张图片' });
        }

        const userId = req.session.userId;
        const stored = await persistImage(req.file, AVATAR_DIR, `avatar-${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}`);
        // 生成网页可访问的路径 (注意：Web路径用正斜杠 /)
        let webPath = '/uploads/avatars/' + stored.filename;
        
        // 更新数据库路径
        await dbPool.query(
            'UPDATE users SET avatar = ? WHERE id = ?',
            [webPath, userId]
        );

        res.json({ message: '头像上传成功', avatarUrl: webPath });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(error.status || 500).json({ message: error.status ? error.message : '头像上传失败' });
    }
});

// API: 其他用户数据 (保持不变)
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

router.post('/api/user/signature', isAuthenticated, async (req, res) => {
    const { signature } = req.body;

    // 验证字数
    if (signature && signature.length > 50) {
        return res.status(400).json({ message: '签名不能超过50个字符' });
    }

    try {
        const userId = req.session.userId;
        await dbPool.query(
            'UPDATE users SET signature = ? WHERE id = ?',
            [signature || '', userId]
        );
        res.json({ message: '签名更新成功', signature });
    } catch (error) {
        console.error('Update signature error:', error);
        res.status(500).json({ message: '更新签名失败' });
    }
});

module.exports = router;
// 更新用户个人资料
router.put('/api/user/profile', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { nickname } = req.body;
    const normalizedNickname = String(nickname || '').trim();

    if (!normalizedNickname) {
        return res.status(400).json({ message: '昵称不能为空' });
    }
    if (normalizedNickname.length < 2 || normalizedNickname.length > 32 || /[<>\x00-\x1f\x7f]/u.test(normalizedNickname)) {
        return res.status(400).json({ message: '昵称须为 2 到 32 个字符，且不能包含 HTML 或控制字符' });
    }

    let connection;
    try {
        // 检查昵称是否已被其他用户使用
        const [existing] = await dbPool.query(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [normalizedNickname, userId]
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: '该昵称已被使用' });
        }

        // 更新用户名 (数据库中没有 bio 字段，暂时忽略 bio)
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        await connection.query('UPDATE users SET username = ? WHERE id = ?', [normalizedNickname, userId]);
        await connection.query('UPDATE cocktails SET created_by = ? WHERE created_by = ?', [normalizedNickname, req.session.username]);
        await connection.commit();

        // 更新 Session 中的用户名
        req.session.username = normalizedNickname;

        res.json({ 
            message: '个人资料已更新', 
            username: normalizedNickname
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: '更新个人资料失败' });
    } finally {
        connection?.release();
    }
});


module.exports = router;
