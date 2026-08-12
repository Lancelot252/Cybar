const dbPool = require('../config/db');

function expectsJson(req) {
    return req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json';
}

function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    if (expectsJson(req)) return res.status(401).json({ message: '请先登录' });
    return res.redirect('/auth/login/');
}

async function isAdmin(req, res, next) {
    if (!req.session.userId) {
        if (expectsJson(req)) return res.status(401).json({ message: '请先登录' });
        return res.redirect('/auth/login/');
    }

    try {
        const [users] = await dbPool.query('SELECT username, role FROM users WHERE id = ? LIMIT 1', [req.session.userId]);
        if (!users.length) {
            return req.session.destroy(() => {
                if (expectsJson(req)) return res.status(401).json({ message: '会话已失效' });
                return res.redirect('/auth/login/');
            });
        }
        req.session.username = users[0].username;
        req.session.role = users[0].role || 'user';
        if (req.session.role !== 'admin') {
            if (expectsJson(req)) return res.status(403).json({ message: '需要管理员权限' });
            return res.status(403).send('Forbidden');
        }
        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = { isAuthenticated, isAdmin };
