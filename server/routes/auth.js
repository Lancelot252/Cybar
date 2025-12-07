const express = require('express');
const router = express.Router();
const dbPool = require('../config/db'); // 引入数据库连接
const path = require('path');

// 项目根目录 (server 的上级目录)
const ROOT_DIR = path.join(__dirname, '..', '..');

// API Route to get current authentication status
router.get('/api/auth/status', (req, res) => {
    if (req.session.userId) {
        console.log(`Auth Status Check: User ${req.session.username}, Role: ${req.session.role}`);
        res.json({
            loggedIn: true,
            username: req.session.username,
            role: req.session.role
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// Serve static HTML pages for auth
router.get('/auth/login/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'auth', 'login.html'));
});

router.get('/auth/register/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'auth', 'register.html'));
});

// Register a new user
router.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码不能为空' });
    }
    if (password.length < 3) {
        return res.status(400).json({ message: '密码长度至少需要3位' });
    }
    try {
        // 检查用户名是否已存在
        const [users] = await dbPool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length > 0) {
            return res.status(409).json({ message: '用户名已被注册' });
        }
        // 生成13位随机数字id
        const id = Math.floor(Math.random() * 9e12 + 1e12).toString();
        // 插入新用户
        await dbPool.query(
            'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)',
            [id, username, password, 'user']
        );
        res.status(201).json({ message: '注册成功' });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: '注册过程中发生服务器错误' });
    }
});

router.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码不能为空' });
    }
    try {
        const [users] = await dbPool.query(
            'SELECT * FROM users WHERE username = ? AND password = ?',
            [username, password]
        );
        if (users.length === 0) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        const user = users[0];
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role || 'user';
        res.status(200).json({ message: '登录成功' });
    } catch (error) {
        console.log(user);
        console.error("Login error:", error);
        res.status(500).json({ message: '服务器错误' });
    }
});

router.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: '无法注销，请稍后重试' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.status(200).json({ message: '注销成功' });
        // Or redirect: res.redirect('/auth/login/');
    });
});

module.exports = router;