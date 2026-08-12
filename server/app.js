require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const recipesRoutes = require('./routes/recipes');
const userRoutes = require('./routes/user');
const customRoutes = require('./routes/custom');
const recommendationsRoutes = require('./routes/recommendations');

const ROOT_DIR = path.join(__dirname, '..');
const app = express();

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') {
    // HTTPS is terminated by the first reverse proxy (for example Nginx).
    // Trust its X-Forwarded-Proto header so secure session cookies are issued.
    app.set('trust proxy', 1);
}
app.use(express.static(ROOT_DIR));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'development-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

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

module.exports = app;
module.exports.pageVisitCounts = pageVisitCounts;
