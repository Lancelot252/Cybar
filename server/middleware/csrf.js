const crypto = require('crypto');

function ensureToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
    }
    return req.session.csrfToken;
}

function csrfTokenRoute(req, res) {
    res.set('Cache-Control', 'no-store');
    res.json({ csrfToken: ensureToken(req) });
}

function csrfProtection(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const expected = ensureToken(req);
    const supplied = String(req.get('X-CSRF-Token') || '');
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);

    if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
        return res.status(403).json({ message: '请求验证失败，请刷新页面后重试', code: 'CSRF_INVALID' });
    }
    return next();
}

module.exports = { csrfTokenRoute, csrfProtection };
