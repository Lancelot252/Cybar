require('dotenv').config();

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const dbPool = require('./config/db');
const MySQLSessionStore = require('./services/mysqlSessionStore');
const { csrfTokenRoute, csrfProtection } = require('./middleware/csrf');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const recipesRoutes = require('./routes/recipes');
const userRoutes = require('./routes/user');
const customRoutes = require('./routes/custom');
const recommendationsRoutes = require('./routes/recommendations');

const ROOT_DIR = path.join(__dirname, '..');
const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || '';

if (isProduction && sessionSecret.length < 32) {
    throw new Error('生产环境必须配置至少 32 个字符的 SESSION_SECRET');
}

app.disable('x-powered-by');
if (isProduction) {
    // HTTPS is terminated by the first reverse proxy (for example Nginx).
    // Trust its X-Forwarded-Proto header so secure session cookies are issued.
    app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');
}
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
            fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(session({
    name: 'cybar.sid',
    secret: sessionSecret || require('crypto').randomBytes(32).toString('hex'),
    store: isProduction && process.env.SESSION_STORE !== 'memory' ? new MySQLSessionStore(dbPool) : undefined,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));
app.get('/api/csrf-token', csrfTokenRoute);
app.use(csrfProtection);

const pageVisitCounts = { '/': 0, '/recipes/': 0, '/calculator/': 0, '/admin/': 0 };
app.use((req, _res, next) => {
    const key = req.path.endsWith('/') ? req.path : `${req.path}/`;
    if (req.method === 'GET' && Object.hasOwn(pageVisitCounts, key)) pageVisitCounts[key] += 1;
    next();
});

app.use('/', authRoutes);
app.use('/', adminRoutes);
app.use('/', recipesRoutes);
app.use('/', userRoutes);
app.use('/', customRoutes);
app.use('/', recommendationsRoutes);
app.get('/', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));

const staticOptions = { dotfiles: 'deny', index: false, maxAge: isProduction ? '1d' : 0 };
app.get('/style.css', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'style.css')));
for (const directory of ['styles', 'js', 'auth', 'calculator', 'custom', 'profile', 'recipes', 'admin']) {
    app.use(`/${directory}`, express.static(path.join(ROOT_DIR, directory), staticOptions));
}
app.use('/uploads', (req, res, next) => {
    if (!/\.(?:jpe?g|png|webp)$/i.test(req.path)) return res.sendStatus(404);
    res.set('Content-Security-Policy', "default-src 'none'; sandbox");
    res.set('X-Content-Type-Options', 'nosniff');
    next();
}, express.static(path.join(ROOT_DIR, 'uploads'), staticOptions));

app.use((error, req, res, _next) => {
    console.error('Unhandled request error:', error.message);
    if (res.headersSent) return;
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ message: '服务器内部错误' });
    }
    return res.sendStatus(500);
});

module.exports = app;
module.exports.pageVisitCounts = pageVisitCounts;
