const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dbPool = require('../config/db');
const { createRateLimit } = require('../services/rateLimit');

const router = express.Router();
const ROOT_DIR = path.join(__dirname, '..', '..');
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
const loginLimit = createRateLimit({
    name: 'login', limit: 8, windowMs: 15 * 60 * 1000,
    key: req => req.ip
});
const registerLimit = createRateLimit({
    name: 'register', limit: 10, windowMs: 60 * 60 * 1000, key: req => req.ip
});

function normalizedCredentials(body) {
    return {
        username: String(body?.username || '').trim(),
        password: String(body?.password || '')
    };
}

function validUsername(username) {
    return username.length >= 2 && username.length <= 32 && !/[<>\x00-\x1f\x7f]/u.test(username);
}

function validPassword(password) {
    return password.length >= 10 && password.length <= 72 && Buffer.byteLength(password, 'utf8') <= 72;
}

function samePlaintextPassword(actual, supplied) {
    const left = Buffer.from(String(actual || ''));
    const right = Buffer.from(supplied);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

router.get('/api/auth/status', (req, res) => {
    if (!req.session.userId) return res.json({ loggedIn: false });
    return res.json({ loggedIn: true, username: req.session.username, role: req.session.role });
});

router.get('/auth/login/', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'auth', 'login.html')));
router.get('/auth/register/', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'auth', 'register.html')));

router.post('/api/register', registerLimit, async (req, res) => {
    const { username, password } = normalizedCredentials(req.body);
    if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
    if (!validUsername(username)) return res.status(400).json({ message: '用户名须为 2 到 32 个字符，且不能包含 HTML 或控制字符' });
    if (!validPassword(password)) return res.status(400).json({ message: '密码须为 10 到 72 个字符' });

    try {
        const [users] = await dbPool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
        if (users.length) return res.status(409).json({ message: '用户名已被注册' });
        const id = crypto.randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(password, 12);
        await dbPool.query(
            'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)',
            [id, username, passwordHash, 'user']
        );
        return res.status(201).json({ message: '注册成功' });
    } catch (error) {
        console.error('Registration error:', error.message);
        return res.status(500).json({ message: '注册过程中发生服务器错误' });
    }
});

router.post('/api/login', loginLimit, async (req, res) => {
    const { username, password } = normalizedCredentials(req.body);
    if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });

    try {
        const [users] = await dbPool.query(
            'SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1',
            [username]
        );
        const user = users[0];
        if (!user) {
            await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        const storedPassword = String(user?.password || '');
        const isHash = /^\$2[aby]\$/.test(storedPassword);
        const resetRequired = storedPassword.startsWith('!reset!');
        const matches = !resetRequired && (isHash
            ? await bcrypt.compare(password, user.password)
            : samePlaintextPassword(user.password, password));
        if (!matches) return res.status(401).json({ message: resetRequired ? '该账号需要管理员重置密码' : '用户名或密码错误' });

        if (!isHash) {
            await dbPool.query('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(password, 12), user.id]);
        }
        await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role || 'user';
        await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
        return res.status(200).json({ message: '登录成功' });
    } catch (error) {
        console.error('Login error:', { username, error: error.message });
        return res.status(500).json({ message: '服务器错误' });
    }
});

router.post('/api/logout', (req, res) => {
    req.session.destroy(error => {
        if (error) return res.status(500).json({ message: '无法注销，请稍后重试' });
        res.clearCookie('cybar.sid');
        return res.status(200).json({ message: '注销成功' });
    });
});

module.exports = router;
