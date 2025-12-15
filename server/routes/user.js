const express = require('express');
const router = express.Router();
const dbPool = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); // 引入刚安装的 multer
const { isAuthenticated } = require('../middleware/auth');

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..', '..');

// --- 配置 Multer (图片存储策略) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 确保路径存在
        const uploadPath = path.join(ROOT_DIR, 'uploads', 'avatars');
        if (!fs.existsSync(uploadPath)){
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // 重命名文件: avatar-用户ID-时间戳.后缀
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${req.session.userId}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 限制 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件！'));
        }
    }
});

// --- 路由 ---

// 页面路由
router.get('/profile/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'profile', 'index.html'));
});

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
router.post('/api/user/avatar', isAuthenticated, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '请选择一张图片' });
        }

        const userId = req.session.userId;
        // 生成网页可访问的路径 (注意：Web路径用正斜杠 /)
        let webPath = '/uploads/avatars/' + req.file.filename;
        
        // 更新数据库路径
        await dbPool.query(
            'UPDATE users SET avatar = ? WHERE id = ?',
            [webPath, userId]
        );

        res.json({ message: '头像上传成功', avatarUrl: webPath });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: '上传失败: ' + error.message });
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