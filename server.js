// 自动配置AI密钥
const fs = require('fs').promises; // 使用promises版本  
const fsSync = require('fs'); // 同步版本用于启动时配置
const path = require('path');

// 尝试加载.env文件（如果存在）
try {
    require('dotenv').config();
} catch (error) {
    console.log('🔧 dotenv加载失败，使用直接环境变量设置');
}

// AI密钥配置 - 从多个来源尝试获取
let deepseekApiKey = null;
let qwenApiKey = null;

// 从配置文件获取API密钥
const configFile = path.join(__dirname, 'config.json');
if (fsSync.existsSync(configFile)) {
    try {
        const config = JSON.parse(fsSync.readFileSync(configFile, 'utf8'));

        // 加载DeepSeek密钥
        if (config.DEEPSEEK_API_KEY && config.DEEPSEEK_API_KEY !== 'sk-your-api-key-here') {
            deepseekApiKey = config.DEEPSEEK_API_KEY;
            console.log('🤖 从配置文件加载了DeepSeek API密钥');
        }

        // 加载千问密钥
        if (config.QWEN_API_KEY && config.QWEN_API_KEY !== 'sk-your-api-key-here') {
            qwenApiKey = config.QWEN_API_KEY;
            console.log('🤖 从配置文件加载了千问 API密钥');
        }
    } catch (error) {
        console.log('⚠️ 配置文件读取失败:', error.message);
    }
}

// ============================================================
// 🔧 AI模型切换开关 - 在这里选择使用哪个AI模型
// ============================================================
// 可选值: 'deepseek' 或 'qwen'
const AI_MODEL_PREFERENCE = 'qwen';  // ← 修改这里切换模型
// ============================================================

// 根据偏好设置环境变量
if (AI_MODEL_PREFERENCE === 'deepseek' && deepseekApiKey) {
    process.env.DEEPSEEK_API_KEY = deepseekApiKey;
    process.env.AI_PROVIDER = 'deepseek';
    console.log('🤖 将使用 DeepSeek 模型');
} else if (AI_MODEL_PREFERENCE === 'qwen' && qwenApiKey) {
    process.env.QWEN_API_KEY = qwenApiKey;
    process.env.AI_PROVIDER = 'qwen';
    console.log('🤖 将使用千问Turbo模型 (响应更快)');
} else if (deepseekApiKey) {
    process.env.DEEPSEEK_API_KEY = deepseekApiKey;
    process.env.AI_PROVIDER = 'deepseek';
    console.log('🤖 将使用 DeepSeek 模型 (备选)');
} else if (qwenApiKey) {
    process.env.QWEN_API_KEY = qwenApiKey;
    process.env.AI_PROVIDER = 'qwen';
    console.log('🤖 将使用千问Turbo模型 (备选)');
} else {
    console.log('⚠️ 未找到有效的AI密钥，将使用演示模式');
}

const express = require('express');
// path和fs已在文件开头声明
const session = require('express-session'); // Import express-session
const mysql = require('mysql2/promise'); // 新增
const axios = require('axios'); // AI功能所需

const app = express();
const port = 8080; // Change port number to 8080

// 数据库连接池
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    // password: 'ABzj#12345678',
    password: 'zqd20040504',  // 本地调试密码
    database: 'zqd_cybar',    // 本地数据库名
    port: 3306,
    charset: 'utf8mb4'
});

// --- Visit Counter (In-Memory - Resets on server restart) ---
// Use an object to store counts per path
const pageVisitCounts = {
    '/': 0, // Main page
    '/recipes/': 0,
    '/calculator/': 0,
    '/admin/': 0, // Count attempts to access, even if redirected
    // Add other paths if needed, ensure they match the GET route paths
};

const USERS_FILE = path.join(__dirname, 'users.json');
const RECIPES_FILE = path.join(__dirname, 'recipes.json');
const COMMENTS_FILE = path.join(__dirname, 'comments.json');
const LIKES_FILE = path.join(__dirname, 'likes.json');
const FAVORITES_FILE = path.join(__dirname, 'favorites.json');

// 新增常量 - 自定义鸡尾酒相关文件路径
const INGREDIENTS_FILE = path.join(__dirname, 'custom', 'ingredients.json');
const CUSTOM_COCKTAILS_FILE = path.join(__dirname, 'custom', 'custom_cocktails.json');

// Middleware
// Middleware to count page loads (HTML requests)
app.use((req, res, next) => {
    // Increment counter only for GET requests that likely return HTML pages we track
    const pathKey = req.path.endsWith('/') ? req.path : req.path + '/'; // Normalize path to end with /

    if (req.method === 'GET' && pageVisitCounts.hasOwnProperty(pathKey)) {
        pageVisitCounts[pathKey]++;
        console.log(`Visit counts: ${JSON.stringify(pageVisitCounts)}`); // Log visit counts
    }
    next(); // Continue to the next middleware/route
});

app.use(express.static(__dirname)); // Serve static files from the root directory
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// Session configuration
app.use(session({
    secret: 'your secret key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Helper function to read users
const readUsers = async () => {
    try {
        // Explicitly specify utf8 encoding and handle potential BOM
        let data = await fs.readFile(USERS_FILE, 'utf8');
        // Remove BOM if present (common issue with UTF-8 files edited in Windows Notepad)
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If file doesn't exist, return empty array
            console.log("users.json not found, returning empty array."); // Add log
            return [];
        }
        // Log the specific JSON parsing error as well
        console.error("Error reading or parsing users file:", error);
        throw error; // Re-throw other errors
    }
};

// Helper function to write users
const writeUsers = async (users) => {
    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) {
        console.error("Error writing users file:", error);
        throw error;
    }
};

// --- Helper function to read comments ---
const readComments = async () => {
    try {
        let data = await fs.readFile(COMMENTS_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) { data = data.slice(1); }
        // Comments stored as an object: { "recipeId": [ { comment }, ... ], ... }
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("comments.json not found, returning empty object.");
            return {}; // Return empty object if file doesn't exist
        }
        console.error("Error reading or parsing comments file:", error);
        throw error;
    }
};

// --- Helper function to write comments ---
const writeComments = async (comments) => {
    try {
        await fs.writeFile(COMMENTS_FILE, JSON.stringify(comments, null, 2), 'utf8');
    } catch (error) {
        console.error("Error writing comments file:", error);
        throw error;
    }
};

// Helper function to read likes
const readLikes = async () => {
    try {
        let data = await fs.readFile(LIKES_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) { data = data.slice(1); }
        const likes = JSON.parse(data);
        // Calculate total likes
        totalLikes = Object.values(likes).reduce((sum, recipes) => sum + recipes.length, 0);
        return likes;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("likes.json not found, returning empty object.");
            totalLikes = 0;
            return {}; // Return empty object if file doesn't exist
        }
        console.error("Error reading or parsing likes file:", error);
        throw error;
    }
};

// Helper function to write likes
const writeLikes = async (likes) => {
    try {
        await fs.writeFile(LIKES_FILE, JSON.stringify(likes, null, 2), 'utf8');
        // Update total likes count
        totalLikes = Object.values(likes).reduce((sum, recipes) => sum + recipes.length, 0);
    } catch (error) {
        console.error("Error writing likes file:", error);
        throw error;
    }
};
// Helper function to read favorites
const readFavorites = async () => {
    try {
        let data = await fs.readFile(FAVORITES_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) { data = data.slice(1); }
        const favorites = JSON.parse(data);
        // Calculate total favorites
        totalFavorites = Object.values(favorites).reduce((sum, recipes) => sum + recipes.length, 0);
        return favorites;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("favorites.json not found, returning empty object.");
            totalFavorites = 0;
            return {}; // Return empty object if file doesn't exist
        }
        console.error("Error reading or parsing favorites file:", error);
        throw error;
    }
};

// Helper function to write favorites
const writeFavorites = async (favorites) => {
    try {
        await fs.writeFile(FAVORITES_FILE, JSON.stringify(favorites, null, 2), 'utf8');
        // Update total favorites count
        totalFavorites = Object.values(favorites).reduce((sum, recipes) => sum + recipes.length, 0);
    } catch (error) {
        console.error("Error writing favorites file:", error);
        throw error;
    }
};

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next(); // User is logged in, proceed
    }

    // Check if the request likely expects JSON (API request)
    // Heuristic: Check 'Accept' header or if path starts with '/api/'
    const isApiRequest = req.accepts('json') || req.path.startsWith('/api/');

    if (isApiRequest) {
        // For API requests, send 401 Unauthorized status and JSON error
        console.log(`Authentication failed for API request: ${req.method} ${req.originalUrl}`); // Add log
        res.status(401).json({ message: 'Authentication required. Please log in.' });
    } else {
        // For non-API requests (likely browser page navigation), redirect to login
        console.log(`Redirecting unauthenticated page request to login: ${req.method} ${req.originalUrl}`); // Add log
        res.redirect('/auth/login/');
    }
};

// --- Admin Check Middleware (No longer needs 'god') ---
const isAdmin = (req, res, next) => {
    // Must be authenticated first
    if (!req.session.userId) {
        // For API requests, send 401 Unauthorized status and JSON error
        if (req.accepts('json') || req.path.startsWith('/api/')) {
            console.log(`Authentication required for admin resource: ${req.method} ${req.originalUrl}`);
            return res.status(401).json({ message: 'Authentication required.' });
        } else {
            // For non-API requests (page access), redirect to login
            console.log(`Redirecting unauthenticated admin page request to login: ${req.method} ${req.originalUrl}`);
            return res.redirect('/auth/login/'); // Redirect to login if not authenticated at all
        }
    }

    // Check if the role stored in session is 'admin'
    const userRole = req.session.role;
    if (userRole !== 'admin') { // Only check for 'admin' now
        console.log(`Forbidden: User ${req.session.username} (role: ${userRole}) tried to access admin resource: ${req.method} ${req.originalUrl}`);
        // For API requests, send 403 Forbidden JSON
        if (req.accepts('json') || req.path.startsWith('/api/')) {
            return res.status(403).json({ message: 'Forbidden: Administrator access required.' });
        } else {
            // For page requests, send HTML with an alert and redirect
            res.status(403).send(`
                <!DOCTYPE html>
                <html lang="zh-cn">
                <head>
                    <meta charset="UTF-8">
                    <title>访问受限</title>
                    <link rel="stylesheet" href="/style.css"> <!-- Optional: Link to your stylesheet -->
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; }
                        .message-box { padding: 20px; background-color: #2a2a2a; border: 1px solid #444; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="message-box">
                        <p>正在处理...</p>
                    </div>
                    <script>
                        alert('仅管理员可用！');
                        window.location.href = '/'; // Redirect to homepage
                    </script>
                </body>
                </html>
            `);
            return; // Stop further processing
        }
    }
    // User is admin, proceed
    next();
};

// --- Routes ---

// API Route to get current authentication status
app.get('/api/auth/status', (req, res) => {
    if (req.session.userId) {
        // --- 关键点：确保 session 中的 role 被包含在响应中 ---
        console.log(`Auth Status Check: User ${req.session.username}, Role: ${req.session.role}`); // 添加日志确认
        res.json({
            loggedIn: true,
            username: req.session.username,
            role: req.session.role // 确保这里传递了 role
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// Serve static HTML pages for auth
app.get('/auth/login/', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth', 'login.html'));
});

app.get('/auth/register/', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth', 'register.html'));
});

// API Routes for Authentication

// Register a new user
app.post('/api/register', async (req, res) => {
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

app.post('/api/login', async (req, res) => {
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

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: '无法注销，请稍后重试' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.status(200).json({ message: '注销成功' });
        // Or redirect: res.redirect('/auth/login/');
    });
});

// --- Protected Routes ---

app.get('/admin/', isAuthenticated, isAdmin, (req, res) => { // Add isAdmin middleware
    res.sendFile(path.join(__dirname, 'admin', 'index.html')); // Assuming admin page is index.html
});

// --- Admin API Routes (Require isAdmin) ---

// API to DELETE a recipe
app.delete('/api/recipes/:id', isAuthenticated, isAdmin, async (req, res) => {
    const recipeIdToDelete = req.params.id;
    try {
        // 先检查数据库中是否存在该配方
        const [recipes] = await dbPool.query('SELECT * FROM cocktails WHERE id = ?', [recipeIdToDelete]);
        if (recipes.length === 0) {
            return res.status(404).json({ message: '未找到要删除的配方' });
        }
        // 删除配方
        await dbPool.query('DELETE FROM cocktails WHERE id = ?', [recipeIdToDelete]);
        // 可选：同时删除相关的 ingredients、评论等
        await dbPool.query('DELETE FROM ingredients WHERE cocktail_id = ?', [recipeIdToDelete]);
        await dbPool.query('DELETE FROM comment WHERE thread_id = ?', [recipeIdToDelete]);
        res.status(200).json({ message: '配方删除成功' });
    } catch (error) {
        console.error(`Error deleting recipe ${recipeIdToDelete}:`, error);
        res.status(500).json({ message: '删除配方时出错' });
    }
});

// API to get admin statistics
app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req, res) => { // Add isAdmin middleware
    const stats = {
        totalRecipes: 0,
        visits: pageVisitCounts,
        totalUsers: 0
    };
    try {
        const [[{ totalRecipes }]] = await dbPool.query('SELECT COUNT(*) AS totalRecipes FROM cocktails');
        const [[{ totalUsers }]] = await dbPool.query('SELECT COUNT(*) AS totalUsers FROM users');
        stats.totalRecipes = totalRecipes;
        stats.totalUsers = totalUsers;
        res.json(stats);
    } catch (error) {
        console.error("Error reading stats from DB:", error);
        res.json(stats);
    }
});

// --- New API Route to get all users (Admin only - MODIFIED FOR PAGINATION) ---
app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    try {
        const [users] = await dbPool.query(
            'SELECT id, username, role FROM users LIMIT ? OFFSET ?', [limit, offset]
        );
        const [[{ total }]] = await dbPool.query('SELECT COUNT(*) AS total FROM users');
        res.json({
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            users
        });
    } catch (error) {
        res.status(500).json({ message: '无法加载用户信息' });
    }
});

// --- New API Route to get ALL comments (Admin only - MODIFIED FOR PAGINATION) ---
app.get('/api/admin/comments', isAuthenticated, isAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    const recipeId = (req.query.recipeId || '').trim();
    const userQuery = (req.query.userQuery || '').trim(); // 可为 user_id 或 username

    // 动态构建 WHERE 条件
    let whereClauses = [];
    let params = [];
    if (recipeId) {
        whereClauses.push('thread_id = ?');
        params.push(recipeId);
    }
    if (userQuery) {
        // 同时匹配 user_id 精确或 username 精确 / 模糊，可按需调整
        whereClauses.push('(user_id = ? OR username = ?)');
        params.push(userQuery, userQuery);
    }
    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    try {
        // 查询总评论数（带筛选）
        const countSql = `SELECT COUNT(*) AS total FROM comment ${whereSql}`;
        const [[{ total }]] = await dbPool.query(countSql, params);

        // 查询当前页评论（带筛选）
        const dataSql = `
            SELECT id, thread_id AS recipeId, user_id, username, text, timestamp
            FROM comment
            ${whereSql}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?`;
        const dataParams = params.concat([limit, offset]);
        const [comments] = await dbPool.query(dataSql, dataParams);

        res.json({
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            comments,
            filter: {
                recipeId: recipeId || null,
                userQuery: userQuery || null
            }
        });
    } catch (error) {
        console.error('Error reading comments for admin (with filters):', error);
        res.status(500).json({ message: '无法加载评论信息' });
    }
});

// --- New API Route to DELETE a comment (Admin only) ---
// Ensure this route is already protected by isAuthenticated and isAdmin
app.delete('/api/comments/:commentId', isAuthenticated, isAdmin, async (req, res) => {
    const commentIdToDelete = req.params.commentId;
    const adminUsername = req.session.username;
    console.log(`Admin '${adminUsername}' attempting to delete comment ID: ${commentIdToDelete}`);

    try {
        // 检查数据库中是否存在该评论
        const [comments] = await dbPool.query('SELECT * FROM comment WHERE id = ?', [commentIdToDelete]);
        if (comments.length === 0) {
            return res.status(404).json({ message: '未找到要删除的评论' });
        }
        // 删除评论
        await dbPool.query('DELETE FROM comment WHERE id = ?', [commentIdToDelete]);
        console.log(`Admin '${adminUsername}' successfully deleted comment ${commentIdToDelete}`);
        res.status(200).json({ message: '评论删除成功' });
    } catch (error) {
        console.error(`Error during deletion of comment ${commentIdToDelete} by admin '${adminUsername}':`, error);
        res.status(500).json({ message: '删除评论时发生服务器内部错误' });
    }
});

// --- User Management API Routes (Now require isAdmin) ---

// API Route to DELETE a user (Requires Admin)
app.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
    const userIdToDelete = req.params.userId;
    const adminUserId = req.session.userId;
    if (userIdToDelete == adminUserId) {
        return res.status(400).json({ message: '无法删除自己的账户' });
    }
    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE id = ?', [userIdToDelete]);
        if (users.length === 0) {
            return res.status(404).json({ message: '未找到要删除的用户' });
        }
        await dbPool.query('DELETE FROM users WHERE id = ?', [userIdToDelete]);
        res.status(200).json({ message: '用户删除成功' });
    } catch (error) {
        console.error(`Error deleting user ${userIdToDelete}:`, error);
        res.status(500).json({ message: '删除用户时出错' });
    }
});

// API Route to update a user's role (Requires Admin)
app.put('/api/admin/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
    const userIdToUpdate = req.params.userId;
    const { newRole } = req.body;
    const adminUserId = req.session.userId;
    const validRoles = ['user', 'admin'];
    if (!newRole || !validRoles.includes(newRole)) {
        return res.status(400).json({ message: `无效的角色。有效角色: ${validRoles.join(', ')}` });
    }
    if (userIdToUpdate === adminUserId && newRole !== 'admin') {
        return res.status(400).json({ message: '无法降低自己的管理员权限' });
    }
    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE id = ?', [userIdToUpdate]);
        if (users.length === 0) {
            return res.status(404).json({ message: '未找到要修改的用户' });
        }
        await dbPool.query('UPDATE users SET role = ? WHERE id = ?', [newRole, userIdToUpdate]);
        res.status(200).json({ message: '用户角色修改成功' });
    } catch (error) {
        console.error(`Error updating role for user ${userIdToUpdate}:`, error);
        res.status(500).json({ message: '修改用户角色时出错' });
    }
});

// --- Existing Routes (Example - adapt as needed) ---

app.get('/recipes/', (req, res) => {
    res.sendFile(path.join(__dirname, 'recipes', 'index.html')); // Assuming recipes page is index.html
});

app.get('/calculator/', (req, res) => {
    res.sendFile(path.join(__dirname, 'calculator', 'index.html')); // Assuming calculator page is index.html
});

// API to get recipes (example) - Gets ALL recipes -> NOW WITH PAGINATION & COUNTS
app.get('/api/recipes', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search ? req.query.search.trim() : '';
    // ingredients filter removed: no longer support filtering recipes by ingredient names
    const sort = req.query.sort || 'default';
    const offset = (page - 1) * limit;

    let where = '';
    let params = [];
    let orderBy = '';

    if (search) {
        where = 'WHERE name LIKE ?';
        params.push(`%${search}%`);
    }

    // removed ingredientNames handling

    // 根据排序类型确定ORDER BY子句
    switch (sort) {
        case 'likes':
            orderBy = 'ORDER BY likeCount DESC, c.created_at DESC';
            break;
        case 'favorites':
            orderBy = 'ORDER BY favoriteCount DESC, c.created_at DESC';
            break;
        case 'name':
            orderBy = 'ORDER BY c.name ASC';
            break;
        case 'default':
        default:
            orderBy = 'ORDER BY c.created_at DESC';
            break;
    }

    try {
        // 查询总数
        const countSql = `SELECT COUNT(*) AS total FROM cocktails ${where}`;
        const [[{ total }]] = await dbPool.query(countSql, params);

        // 查询当前页数据（包含原料信息：GROUP_CONCAT DISTINCT）
        const dataSql = `
            SELECT
                c.id,
                c.name,
                c.created_by AS createdBy,
                c.instructions,
                c.estimated_abv AS estimatedAbv,
                (SELECT COUNT(*) FROM likes WHERE recipe_id = c.id) AS likeCount,
                (SELECT COUNT(*) FROM favorites WHERE recipe_id = c.id) AS favoriteCount,
                GROUP_CONCAT(DISTINCT i.name) AS ingredients
            FROM cocktails c
            LEFT JOIN likes l ON c.id = l.recipe_id
            LEFT JOIN favorites f ON c.id = f.recipe_id
            LEFT JOIN ingredients i ON c.id = i.cocktail_id
            ${where}
            GROUP BY c.id
            ${orderBy}
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const [recipes] = await dbPool.query(dataSql, params);

        res.json({
            recipes: recipes.map(r => ({
                ...r,
                estimatedAbv: Number(r.estimatedAbv) // 保证是数字
            })),
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            sortBy: sort // 返回当前排序方式
        });
    } catch (error) {
        console.error("读取配方时出错:", error);
        res.status(500).json({ message: '读取配方时出错' });
    }
});

// --- Add Route for Single Recipe Detail ---
app.get('/api/recipes/:id', async (req, res) => {
    const recipeId = req.params.id;
    try {
        // 查询配方主表
        const [recipes] = await dbPool.query(
            'SELECT c.id, c.name, c.instructions, c.estimated_abv AS estimatedAbv, c.created_by AS createdBy, (SELECT COUNT(*) FROM likes WHERE recipe_id = c.id) AS likeCount, (SELECT COUNT(*) FROM favorites WHERE recipe_id = c.id) AS favoriteCount FROM cocktails c WHERE c.id = ?', [recipeId]
        );
        if (recipes.length === 0) {
            console.warn(`Recipe with ID ${recipeId} not found.`);
            return res.status(404).json({ message: '未找到配方' });
        }
        // 查询原料表
        const [ingredients] = await dbPool.query(
            'SELECT id, cocktail_id, name, volume, abv FROM ingredients WHERE cocktail_id = ?', [recipeId]
        );
        // 返回配方和原料
        res.json({
            ...recipes[0],
            ingredients
        });
    } catch (error) {
        console.error(`获取配方详情时出错 for recipeId ${recipeId}:`, error);
        res.status(500).json({ message: '获取配方详情时出错' });
    }
});

// --- API Route to get comments for a recipe ---
app.get('/api/recipes/:id/comments', async (req, res) => {
    const recipeId = req.params.id;
    try {
        const [rows] = await dbPool.query(
            `SELECT id, user_id, username, text, timestamp FROM comment WHERE thread_id = ? ORDER BY timestamp DESC`, [recipeId]
        );
        res.json(rows);
    } catch (error) {
        console.error("获取评论时出错:", error);
        res.status(500).json({ message: '无法加载评论' });
    }
});

// --- API Route to add a comment to a recipe (Protected) ---
app.post('/api/recipes/:id/comments', isAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const { commentText } = req.body;
    const userId = req.session.userId;
    const username = req.session.username;

    if (!userId) {
        return res.status(401).json({ message: '请先登录' });
    }

    if (!commentText || commentText.trim() === '') {
        return res.status(400).json({ message: '评论内容不能为空' });
    }

    try {
        // 生成唯一id（用时间戳+随机数即可）
        const commentId = Date.now().toString() + Math.floor(Math.random() * 1000);

        // 插入评论
        await dbPool.query(
            `INSERT INTO comment (id, thread_id, user_id, username, text, timestamp) VALUES (?, ?, ?, ?, ?, NOW())`,
            [commentId, recipeId, userId, username, commentText.trim()]
        );
        // 查询刚插入的评论
        const [rows] = await dbPool.query(
            `SELECT id, user_id, username, text, timestamp FROM comment WHERE id = ?`, [commentId]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error inserting comment:', error);
        res.status(500).json({ message: '提交评论时发生错误' });
    }
});

// 添加新配方（写入MySQL）
app.post('/api/recipes', isAuthenticated, async (req, res) => {
    const newRecipe = req.body;
    const creatorUsername = req.session.username;

    if (!newRecipe || !newRecipe.name) {
        return res.status(400).json({ message: '无效的配方数据' });
    }
    if (!creatorUsername) {
        return res.status(401).json({ message: '无法确定创建者，请重新登录' });
    }

    try {
        // 生成唯一ID（用时间戳字符串或你喜欢的方式）
        const recipeId = Date.now().toString();
        await dbPool.query(
            `INSERT INTO cocktails (id, name, created_by, instructions,estimated_abv)
             VALUES (?, ?, ?, ?, ?)`,
            [
                recipeId,
                newRecipe.name,
                creatorUsername,
                newRecipe.instructions || '',
                newRecipe.estimatedAbv || 0,
            ]
        );
        // 如有 ingredients 等复杂字段，建议单独建 ingredients 表并插入

        res.status(201).json({ message: '配方添加成功', recipe: { id: recipeId, ...newRecipe, createdBy: creatorUsername } });
    } catch (error) {
        console.error("Error adding recipe:", error);
        res.status(500).json({ message: '无法添加配方' });
    }
});

// Root route (optional - can redirect or serve a main page)
app.get('/', (req, res) => {
    // Example: Redirect to recipes page or a dashboard
    res.redirect('/recipes/');
});

// 点赞或取消点赞
app.post('/api/recipes/:id/like', isAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.userId;

    try {
        // 检查是否已点赞
        const [rows] = await dbPool.query(
            'SELECT * FROM likes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]
        );
        console.log('likes结果:', rows);
        if (rows.length === 0) {
            // 未点赞，插入
            const likeId = Date.now().toString() + Math.floor(Math.random() * 1000);
            await dbPool.query('INSERT INTO likes (id, user_id, recipe_id) VALUES (?, ?, ?)', [likeId, userId, recipeId]);
        } else {
            // 已点赞，取消
            await dbPool.query('DELETE FROM likes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]);
        }

        // 获取更新后的点赞和收藏总数
        const [[{ likeCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS likeCount FROM likes WHERE recipe_id = ?', [recipeId]
        );
        const [[{ favoriteCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS favoriteCount FROM favorites WHERE recipe_id = ?', [recipeId]
        );

        res.json({
            success: true,
            isLiked: rows.length === 0, // True if it was just liked, false if unliked
            likeCount,
            favoriteCount
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ message: '操作失败' });
    }
});

// 收藏或取消收藏
app.post('/api/recipes/:id/favorite', isAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.userId;

    try {
        // 检查是否已收藏
        const [rows] = await dbPool.query(
            'SELECT * FROM favorites WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]
        );
        if (rows.length === 0) {
            // 未收藏，插入
            const favId = Date.now().toString() + Math.floor(Math.random() * 1000);
            await dbPool.query('INSERT INTO favorites (id, user_id, recipe_id) VALUES (?, ?, ?)', [favId, userId, recipeId]);
        } else {
            // 已收藏，取消
            await dbPool.query('DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]);
        }

        // 获取更新后的点赞和收藏总数
        const [[{ likeCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS likeCount FROM likes WHERE recipe_id = ?', [recipeId]
        );
        const [[{ favoriteCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS favoriteCount FROM favorites WHERE recipe_id = ?', [recipeId]
        );

        res.json({
            success: true,
            isFavorited: rows.length === 0, // True if it was just favorited, false if unfavorited
            likeCount,
            favoriteCount
        });
    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({ message: '操作失败' });
    }
});

// API Route to get like and favorite status for a recipe
// This route is still useful for the detail page or logged-in specific status
app.get('/api/recipes/:id/interactions', isAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.userId;

    try {
        const [[{ likeCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS likeCount FROM likes WHERE recipe_id = ?', [recipeId]
        );
        const [[{ favoriteCount }]] = await dbPool.query(
            'SELECT COUNT(*) AS favoriteCount FROM favorites WHERE recipe_id = ?', [recipeId]
        );
        const [liked] = await dbPool.query(
            'SELECT 1 FROM likes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]
        );
        const [favorited] = await dbPool.query(
            'SELECT 1 FROM favorites WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]
        );
        res.json({
            likeCount,
            favoriteCount,
            isLiked: liked.length > 0,
            isFavorited: favorited.length > 0
        });
    } catch (error) {
        console.error(`Error getting interactions for recipe ${recipeId}:`, error);
        res.status(500).json({ message: '无法加载交互状态' });
    }
});

// --- User Profile Routes ---
app.get('/api/user/current', isAuthenticated, (req, res) => {
    res.json({
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
    });
});

// 获取当前用户点赞的配方
app.get('/api/user/likes', isAuthenticated, async (req, res) => {
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
app.get('/api/user/favorites', isAuthenticated, async (req, res) => {
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
app.get('/api/user/created-recipes', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.username; // 使用 username 而不是 userId
        const [rows] = await dbPool.query(
            `SELECT id, name, created_by AS createdBy, instructions, estimated_abv AS estimatedAbv
             FROM cocktails
             WHERE created_by = ?`, [username] // 使用 username 作为查询条件
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching user created recipes:', error);
        res.status(500).json({ message: '获取创建配方历史失败' });
    }
});

// 获取当前用户信息
app.get('/api/user/current', isAuthenticated, async (req, res) => {
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

// --- Custom Cocktail Creator Routes ---
// 1. 静态页面路由
app.get('/custom/', (req, res) => {
    res.sendFile(path.join(__dirname, 'custom', 'index.html'));
});

// 2. 获取所有原料的API
app.get('/api/custom/ingredients', async (req, res) => {
    try {
        let data = await fs.readFile(INGREDIENTS_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        const ingredients = JSON.parse(data);

        // Filter helper: decide if an item should be considered a liquid
        const isLiquidItem = (item) => {
            if (!item) return false;
            const unit = (item.unit || '').toString().toLowerCase();

            // Common liquid unit hints: Chinese '毫升' or latin 'ml', 'l', 'cl'
            if (unit.includes('毫') || unit.includes('ml') || unit.includes('cl') || unit === 'l') {
                return true;
            }

            // If unit is absent, fall back to numeric clues: positive volume or positive abv
            if (typeof item.volume === 'number' && item.volume > 0) return true;
            if (typeof item.abv === 'number' && item.abv > 0) return true;

            return false;
        };

        // Build filtered structure: by default show liquid items only,
        // but preserve a few meaningful non-liquid categories so their
        // original items remain visible under their own category (eg garnish).
        const filtered = { ingredients: [] };
        const allowedNonLiquidCategories = new Set(['garnish', 'dairy_cream', 'other', 'spice_herb']);

        if (Array.isArray(ingredients.ingredients)) {
            for (const cat of ingredients.ingredients) {
                if (!cat || !Array.isArray(cat.items)) continue;

                const catKey = (cat.category || '').toString();

                // If this category is one of the allowed non-liquid categories,
                // return all its items (so they stay in their original category).
                if (allowedNonLiquidCategories.has(catKey)) {
                    filtered.ingredients.push({
                        category: cat.category,
                        items: cat.items.slice() // copy
                    });
                    continue;
                }

                // Otherwise only include items that look like liquids
                const liquidItems = cat.items.filter(isLiquidItem);
                if (liquidItems.length > 0) {
                    filtered.ingredients.push({
                        category: cat.category,
                        items: liquidItems
                    });
                }
            }
        }

        // Ensure every ingredient remains associated with some category in the
        // returned structure (avoid silently dropping items). Any remaining
        // uncategorized items will be appended to 'other' category if not present.
        try {
            const includedIds = new Set();
            for (const c of filtered.ingredients) {
                for (const it of c.items || []) {
                    if (it && it.id) includedIds.add(it.id);
                }
            }

            const leftovers = [];
            for (const origCat of (ingredients.ingredients || [])) {
                for (const it of (origCat.items || [])) {
                    if (it && it.id && !includedIds.has(it.id)) {
                        leftovers.push(it);
                    }
                }
            }

            if (leftovers.length > 0) {
                // append leftovers to an 'other' bucket so they are not lost
                let otherCat = filtered.ingredients.find(c => c.category === 'other');
                if (!otherCat) {
                    otherCat = { category: 'other', items: [] };
                    filtered.ingredients.push(otherCat);
                }
                // avoid duplicating items
                const existing = new Set((otherCat.items || []).map(i => i.id));
                for (const it of leftovers) {
                    if (!existing.has(it.id)) otherCat.items.push(it);
                }
            }
        } catch (e) {
            // non-fatal - if anything goes wrong here we still return the filtered result
            console.error('Error while consolidating leftover ingredients:', e);
        }

        res.json(filtered);
    } catch (error) {
        console.error("Error reading ingredients:", error);
        res.status(500).json({ message: '加载原料数据失败' });
    }
});

// 3. 创建自定义鸡尾酒的API
app.post('/api/custom/cocktails', isAuthenticated, async (req, res) => {
    try {
        const newCocktail = req.body;

        // 验证必填字段
        if (!newCocktail.name || !newCocktail.ingredients || newCocktail.ingredients.length === 0) {
            return res.status(400).json({ message: '鸡尾酒名称和至少一种原料是必填的' });
        }

        // 生成唯一ID
        const cocktailId = Date.now().toString();
        const creator = req.session.username;

        // 插入主表 cocktails
        await dbPool.query(
            `INSERT INTO cocktails (id, name, instructions, estimated_abv, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [
                cocktailId,
                newCocktail.name,
                (newCocktail.steps || []).join('\n'),
                newCocktail.estimatedAbv || 0,
                creator
            ]
        );

        // 插入 ingredients 表
        for (const ing of newCocktail.ingredients) {
            await dbPool.query(
                `INSERT INTO ingredients (cocktail_id, name, volume, abv)
                 VALUES (?, ?, ?, ?)`,
                [
                    cocktailId,
                    ing.name,
                    ing.volume,
                    ing.abv
                ]
            );
        }

        res.status(201).json({
            message: '鸡尾酒创建成功',
            id: cocktailId
        });

    } catch (error) {
        console.error("Error creating custom cocktail:", error);
        res.status(500).json({ message: '创建鸡尾酒失败' });
    }
});

// 4. 获取所有自定义鸡尾酒的API
app.get('/api/custom/cocktails', async (req, res) => {
    try {
        let data = await fs.readFile(CUSTOM_COCKTAILS_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        const customCocktails = JSON.parse(data);
        res.json(customCocktails);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // 文件不存在，返回空数组
            return res.json({ cocktails: [] });
        }
        console.error("Error reading custom cocktails:", error);
        res.status(500).json({ message: '加载自定义鸡尾酒失败' });
    }
});

// 5. 获取单个自定义鸡尾酒的API
app.get('/api/custom/cocktails/:id', async (req, res) => {
    const cocktailId = req.params.id;

    try {
        let data = await fs.readFile(CUSTOM_COCKTAILS_FILE, 'utf8');
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        const customCocktails = JSON.parse(data);

        const cocktail = customCocktails.cocktails.find(c => c.id === cocktailId);
        if (!cocktail) {
            return res.status(404).json({ message: '未找到指定的鸡尾酒' });
        }

        res.json(cocktail);
    } catch (error) {
        console.error(`Error reading custom cocktail ${cocktailId}:`, error);
        res.status(500).json({ message: '加载鸡尾酒详情失败' });
    }
});

// 6. AI口味分析API
app.post('/api/custom/analyze-flavor', async (req, res) => {
    try {
        const { ingredients, steps, name, description } = req.body;

        // 验证输入数据
        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ message: '请提供原料信息' });
        }

        // 构建发送给Deepseek的提示
        const ingredientsList = ingredients.map(ing =>
            `${ing.name} (${ing.volume}ml, 酒精度: ${ing.abv}%)`
        ).join(', ');

        const stepsList = steps && steps.length > 0 ? steps.join(' ') : '未提供制作步骤';

        const prompt = `请分析这个鸡尾酒配方的口味特征并给出专业建议：

鸡尾酒名称: ${name || '未命名'}
描述: ${description || '无描述'}
原料: ${ingredientsList}
制作步骤: ${stepsList}

请按照以下格式提供分析，并在开头包含标准化的口味维度评分：

【口味维度评分】
甜度: X/5 (0-5分，0为无甜味，5为极甜)
酸度: X/5 (0-5分，0为无酸味，5为极酸)
苦度: X/5 (0-5分，0为无苦味，5为极苦)
烈度: X/5 (0-5分，0为无酒精感，5为极烈)
清爽度: X/5 (0-5分，0为厚重，5为极清爽)

【详细分析】
1. 整体口感特征分析
2. 风味层次解析 
3. 颜色和视觉效果
4. 香气特点描述
5. 适合场合和人群
6. 改进建议(如有)
7. 与经典鸡尾酒的相似度对比

请用专业但易懂的语言分析，确保口味评分准确反映原料组合的实际特征。`;

        let analysis;

        // 检查是否有API密钥，如果没有则提供演示模式
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey || apiKey === 'sk-your-api-key-here') {
            // 演示模式 - 生成模拟分析结果
            analysis = `🤖 演示模式分析结果

【口味维度评分】
甜度: 3/5 (来自糖浆和果汁的天然甜味)
酸度: 2/5 (适中的酸度平衡，提供清爽口感)
苦度: 1/5 (轻微的苦味层次)
烈度: 3/5 (酒精感适中，不会过于强烈)
清爽度: 4/5 (口感清新爽口)

【详细分析】

**整体口感特征：**
根据您选择的${ingredients.length}种原料，这款鸡尾酒呈现出丰富的层次感。主要特征包括中等偏甜的甜度、适中的酸度平衡、温和的苦味和适中的酒精感，整体口感顺滑圆润，易于入口。

**风味层次分析：**
前调带有明显的果香和酒精香气，中调呈现出原料的核心风味特征，后调留有淡淡的回甘。

**颜色和视觉效果：**
预计呈现出诱人的色泽，具有良好的视觉冲击力。

**适合场合：**
这款鸡尾酒适合休闲聚会、晚餐后饮用，或作为开胃酒。

**改进建议：**
可以考虑调整原料比例以获得更好的平衡感，或添加装饰元素提升视觉效果。

⚠️ 这是演示模式的分析结果。要获得真实的AI分析，请配置有效的Deepseek API密钥。`;
        } else {
            // 调用真实的Deepseek API
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位专业的调酒师和品酒师，拥有丰富的鸡尾酒知识和品鉴经验。请用专业、友好的语调提供详细的口味分析和建议。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 30秒超时
            });

            analysis = response.data.choices[0].message.content;
        }

        res.json({
            success: true,
            analysis: analysis,
            analyzedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('AI分析错误:', error);

        // 处理不同类型的错误
        if (error.response) {
            // API响应错误
            if (error.response.status === 401) {
                return res.status(500).json({
                    message: 'AI服务认证失败，请联系管理员配置API密钥',
                    error: 'API_AUTH_ERROR'
                });
            } else if (error.response.status === 429) {
                return res.status(429).json({
                    message: 'AI服务请求过于频繁，请稍后再试',
                    error: 'RATE_LIMIT_ERROR'
                });
            } else {
                return res.status(500).json({
                    message: 'AI分析服务暂时不可用',
                    error: 'API_ERROR'
                });
            }
        } else if (error.code === 'ECONNABORTED') {
            // 超时错误
            return res.status(408).json({
                message: 'AI分析请求超时，请稍后再试',
                error: 'TIMEOUT_ERROR'
            });
        } else {
            // 其他错误
            return res.status(500).json({
                message: 'AI口味分析失败，请稍后再试',
                error: 'UNKNOWN_ERROR'
            });
        }
    }
});

// 7. AI智能调酒师 - 根据口味描述生成配方
app.post('/api/custom/generate-recipe', async (req, res) => {
    try {
        const { tasteDescription, occasion, alcoholStrength } = req.body;

        // 验证输入数据
        if (!tasteDescription || tasteDescription.trim().length === 0) {
            return res.status(400).json({ message: '请提供口味描述' });
        }

        // 构建发送给Deepseek的提示
        const prompt = `作为专业调酒师，请根据以下需求创建一个鸡尾酒配方：

用户口味需求：${tasteDescription}
${occasion ? `适用场合：${occasion}` : ''}
${alcoholStrength ? `酒精强度偏好：${alcoholStrength}` : ''}

请提供以下信息，使用JSON格式回答：
{
  "name": "鸡尾酒名称",
  "description": "简短描述（1-2句话）",
  "ingredients": [
    {
      "name": "原料名称",
      "volume": 数量（毫升）,
      "abv": 酒精度（百分比数字）,
      "category": "分类（base_alcohol/juice/syrup/soda/garnish/other）"
    }
  ],
  "steps": [
    "详细制作步骤1",
    "详细制作步骤2",
    "..."
  ],
  "glassware": "推荐杯具",
  "garnish": "装饰建议",
  "taste_profile": {
    "sweetness": "甜度等级（1-5）",
    "sourness": "酸度等级（1-5）",
    "bitterness": "苦度等级（1-5）",
    "strength": "烈度等级（1-5）"
  },
  "tips": "调制小贴士"
}

要求：
1. 原料数量要合理，总量控制在100-200ml之间
2. 步骤要详细具体，易于操作
3. 确保口味平衡，符合用户需求
4. 如果用户要求特定酒精强度，请相应调整
5. 只返回JSON，不要其他文字`;

        let recipe;

        // 检查是否有API密钥
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey || apiKey === 'sk-your-api-key-here') {
            // 演示模式 - 生成模拟配方
            recipe = {
                name: "AI灵感特调",
                description: `根据您"${tasteDescription}"的描述，为您推荐这款特色鸡尾酒`,
                ingredients: [
                    {
                        name: "伏特加",
                        volume: 45,
                        abv: 40,
                        category: "base_alcohol"
                    },
                    {
                        name: "蔓越莓汁",
                        volume: 30,
                        abv: 0,
                        category: "juice"
                    },
                    {
                        name: "柠檬汁",
                        volume: 15,
                        abv: 0,
                        category: "juice"
                    },
                    {
                        name: "糖浆",
                        volume: 10,
                        abv: 0,
                        category: "syrup"
                    }
                ],
                steps: [
                    "在调酒器中加入冰块",
                    "依次倒入伏特加、蔓越莓汁、柠檬汁和糖浆",
                    "用力摇晃15-20秒",
                    "用双重过滤器过滤到冰镇的马天尼杯中",
                    "用柠檬皮装饰"
                ],
                glassware: "马天尼杯",
                garnish: "柠檬皮",
                taste_profile: {
                    sweetness: "3",
                    sourness: "2",
                    bitterness: "1",
                    strength: "3"
                },
                tips: "可根据个人喜好调整糖浆用量",
                isDemo: true
            };
        } else {
            // 调用真实的Deepseek API
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位世界顶级的调酒师，拥有丰富的鸡尾酒创作经验。请根据用户的口味需求，创造出完美的鸡尾酒配方。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 1500
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 35000 // 35秒超时
            });

            // 尝试解析JSON响应
            try {
                const jsonMatch = response.data.choices[0].message.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    recipe = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('无法找到JSON格式的配方');
                }
            } catch (parseError) {
                console.error('JSON解析错误:', parseError);
                // 如果解析失败，返回原始文本
                recipe = {
                    name: "AI推荐配方",
                    description: "AI为您生成的特色配方",
                    raw_response: response.data.choices[0].message.content,
                    error: "配方解析失败，请稍后重试"
                };
            }
        }

        res.json({
            success: true,
            recipe: recipe,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('AI配方生成错误:', error);

        // 处理不同类型的错误
        if (error.response) {
            if (error.response.status === 401) {
                return res.status(500).json({
                    message: 'AI服务认证失败，请联系管理员配置API密钥',
                    error: 'API_AUTH_ERROR'
                });
            } else if (error.response.status === 402) {
                // API余额不足，返回演示模式配方
                console.log('⚠️ DeepSeek API余额不足，使用演示模式');
                const demoRecipe = {
                    name: "AI灵感特调",
                    description: `根据您"${tasteDescription}"的描述，为您推荐这款特色鸡尾酒`,
                    ingredients: [
                        { name: "伏特加", volume: 45, abv: 40, category: "base_alcohol" },
                        { name: "蔓越莓汁", volume: 30, abv: 0, category: "juice" },
                        { name: "柠檬汁", volume: 15, abv: 0, category: "juice" },
                        { name: "糖浆", volume: 10, abv: 0, category: "syrup" }
                    ],
                    steps: [
                        "在调酒器中加入冰块",
                        "依次倒入伏特加、蔓越莓汁、柠檬汁和糖浆",
                        "用力摇晃15-20秒",
                        "用双重过滤器过滤到冰镇的马天尼杯中",
                        "用柠檬皮装饰"
                    ],
                    glassware: "马天尼杯",
                    garnish: "柠檬皮",
                    tips: "API余额不足，这是演示配方。请充值DeepSeek账户获得真实AI配方。",
                    isDemo: true
                };
                return res.json({
                    success: true,
                    recipe: demoRecipe,
                    generatedAt: new Date().toISOString()
                });
            } else if (error.response.status === 429) {
                return res.status(429).json({
                    message: 'AI服务请求过于频繁，请稍后再试',
                    error: 'RATE_LIMIT_ERROR'
                });
            } else {
                return res.status(500).json({
                    message: 'AI配方生成服务暂时不可用',
                    error: 'API_ERROR'
                });
            }
        } else if (error.code === 'ECONNABORTED') {
            return res.status(408).json({
                message: 'AI配方生成请求超时，请稍后再试',
                error: 'TIMEOUT_ERROR'
            });
        } else {
            return res.status(500).json({
                message: 'AI配方生成失败，请稍后再试',
                error: 'UNKNOWN_ERROR'
            });
        }
    }
});

// Start server
app.listen(port, () => {
    console.log(`========================================`);
    console.log(`🚀 Cybar 服务器启动成功`);
    console.log(`📍 访问地址: http://localhost:${port}`);
    console.log(`========================================`);

    // 检查AI功能状态
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (apiKey && apiKey !== 'sk-your-api-key-here') {
        console.log(`🤖 AI功能: ✅ 已配置 (${apiKey.substring(0, 10)}...)`);
    } else {
        console.log(`🤖 AI功能: ❌ 未配置 (演示模式)`);
        console.log(`   请配置 DEEPSEEK_API_KEY 环境变量启用AI功能`);
    }
    console.log(`========================================`);
});

// 更新推荐API - 综合协同过滤和原料规范化
app.get('/api/recommendations', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const MAX_RECOMMENDATIONS = 4;

    // 原料名称规范化映射表
    const ingredientNormalizationMap = {
        "金酒 (gin)": "金酒",
        "gin": "金酒",
        "伏特加 (vodka)": "伏特加",
        "vodka": "伏特加",
        "朗姆酒 (rum)": "朗姆酒",
        "rum": "朗姆酒",
        "龙舌兰 (tequila)": "龙舌兰",
        "tequila": "龙舌兰",
        "威士忌 (whiskey)": "威士忌",
        "whiskey": "威士忌",
        "whisky": "威士忌",
        "白兰地 (brandy)": "白兰地",
        "brandy": "白兰地",
        "利口酒 (liqueur)": "利口酒",
        "liqueur": "利口酒",
        "苦精 (bitters)": "苦精",
        "bitters": "苦精",
        "苏打水 (soda)": "苏打水",
        "soda": "苏打水",
        "汤力水 (tonic)": "汤力水",
        "tonic": "汤力水",
        "柠檬汁 (lemon juice)": "柠檬汁",
        "lemon juice": "柠檬汁",
        "青柠汁 (lime juice)": "青柠汁",
        "lime juice": "青柠汁"
        // 可以继续添加更多映射
    };

    // 原料名称规范化函数
    const normalizeIngredient = (ingredient) => {
        const lowerIngredient = ingredient.toLowerCase().trim();

        // 查找映射表中的标准化名称
        for (const [key, value] of Object.entries(ingredientNormalizationMap)) {
            if (lowerIngredient === key.toLowerCase()) {
                return value;
            }
        }

        // 如果没有找到映射，返回原始名称（去除括号内容）
        return ingredient.replace(/\(.*?\)/g, '').trim();
    };

    try {
        // 1) 获取用户交互数据（likes + favorites）
        const [userInteractions] = await dbPool.query(`
            SELECT 
                c.id, c.name, 'like' AS interaction_type, 
                c.estimated_abv AS abv, c.created_by AS creator,
                GROUP_CONCAT(DISTINCT i.name) AS ingredients
            FROM likes l
            JOIN cocktails c ON l.recipe_id = c.id
            JOIN ingredients i ON c.id = i.cocktail_id
            WHERE l.user_id = ?
            GROUP BY c.id
            UNION ALL
            SELECT 
                c.id, c.name, 'favorite' AS interaction_type, 
                c.estimated_abv AS abv, c.created_by AS creator,
                GROUP_CONCAT(DISTINCT i.name) AS ingredients
            FROM favorites f
            JOIN cocktails c ON f.recipe_id = c.id
            JOIN ingredients i ON c.id = i.cocktail_id
            WHERE f.user_id = ?
            GROUP BY c.id
        `, [userId, userId]);

        if (userInteractions.length === 0) {
            return res.json({
                recommendations: [],
                message: "您还没有点赞或收藏任何配方，无法生成推荐"
            });
        }

        // 2) 汇总用户偏好
        const preferenceData = {
            preferredAbv: 0,
            topCreators: new Map(),
            ingredientWeights: new Map(),
            interactedRecipeIds: new Set(),
            recipeIngredientWeights: new Map()  // 新增：存储每个配方的原料权重和
        };
        let totalAbv = 0, abvCount = 0;

        userInteractions.forEach(interaction => {
            preferenceData.interactedRecipeIds.add(interaction.id);

            if (interaction.abv !== null) {
                totalAbv += interaction.abv;
                abvCount++;
            }
            if (interaction.creator) {
                const cnt = preferenceData.topCreators.get(interaction.creator) || 0;
                preferenceData.topCreators.set(interaction.creator, cnt + 1);
            }
            if (interaction.ingredients) {
                const weight = interaction.interaction_type === 'favorite' ? 2 : 1;
                interaction.ingredients.split(',').forEach(rawIng => {
                    const ing = normalizeIngredient(rawIng);
                    const cur = preferenceData.ingredientWeights.get(ing) || 0;
                    preferenceData.ingredientWeights.set(ing, cur + weight);
                });
            }
            // 计算每个配方的原料权重和
            let recipeWeightSum = 0;
            if (interaction.ingredients) {
                interaction.ingredients.split(',').forEach(rawIng => {
                    const ing = normalizeIngredient(rawIng);
                    const weight = interaction.interaction_type === 'favorite' ? 2 : 1;
                    recipeWeightSum += weight;
                });
            }
            preferenceData.recipeIngredientWeights.set(interaction.id, recipeWeightSum);
        });

        // 计算中位数酒精度
        const abvList = [];
        userInteractions.forEach(interaction => {
            if (interaction.abv !== null) {
                abvList.push(interaction.abv);
            }
        });

        if (abvList.length > 0) {
            abvList.sort((a, b) => a - b);
            const mid = Math.floor(abvList.length / 2);
            if (abvList.length % 2 === 1) {
                preferenceData.preferredAbv = abvList[mid];
            } else {
                preferenceData.preferredAbv = (abvList[mid - 1] + abvList[mid]) / 2;
            }
        } else {
            preferenceData.preferredAbv = 0;
        }

        const sortedCreators = Array.from(preferenceData.topCreators.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(item => item[0]);

        const topIngredients = Array.from(preferenceData.ingredientWeights.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(item => item[0]);

        // 3) 协同过滤：找相似用户 & 相似用户喜欢的配方
        const similarUsers = new Map(); // 改为Map存储用户ID和相似度
        if (preferenceData.interactedRecipeIds.size > 0) {
            // 获取所有与当前用户有交集的用户
            const [potentialUsers] = await dbPool.query(`
                SELECT DISTINCT user_id AS userId
                FROM (
                    SELECT user_id, recipe_id FROM likes
                    UNION ALL
                    SELECT user_id, recipe_id FROM favorites
                ) AS interactions
                WHERE recipe_id IN (?)
                AND user_id != ?
            `, [Array.from(preferenceData.interactedRecipeIds), userId]);

            // 获取这些用户的完整互动数据
            const [allInteractions] = await dbPool.query(`
                SELECT user_id AS userId, recipe_id AS recipeId
                FROM (
                    SELECT user_id, recipe_id FROM likes
                    UNION ALL
                    SELECT user_id, recipe_id FROM favorites
                ) AS interactions
                WHERE user_id IN (?)
            `, [potentialUsers.map(u => u.userId)]);

            // 构建用户互动映射
            const userInteractionMap = new Map();
            allInteractions.forEach(ia => {
                if (!userInteractionMap.has(ia.userId)) {
                    userInteractionMap.set(ia.userId, new Set());
                }
                userInteractionMap.get(ia.userId).add(ia.recipeId);
            });

            // 计算Jaccard相似度
            const currentUserSet = preferenceData.interactedRecipeIds;
            potentialUsers.forEach(user => {
                const otherUserSet = userInteractionMap.get(user.userId) || new Set();

                // 计算交集和并集
                const intersection = new Set(
                    [...currentUserSet].filter(id => otherUserSet.has(id))
                );
                const union = new Set([...currentUserSet, ...otherUserSet]);

                // 避免除以零
                const similarity = union.size > 0
                    ? intersection.size / union.size
                    : 0;

                if (similarity > 0.2) {  // 设置相似度阈值
                    similarUsers.set(user.userId, similarity);
                }
            });
        }

        // 4) 拿到所有候选配方
        const [allRecipes] = await dbPool.query(`
            SELECT 
                c.id, c.name, c.estimated_abv AS estimatedAbv, c.created_by AS creator,
                COUNT(DISTINCT l.user_id) AS likeCount,
                COUNT(DISTINCT f.user_id) AS favoriteCount,
                GROUP_CONCAT(DISTINCT i.name) AS ingredients
            FROM cocktails c
            LEFT JOIN likes l ON c.id = l.recipe_id
            LEFT JOIN favorites f ON c.id = f.recipe_id
            JOIN ingredients i ON c.id = i.cocktail_id
            GROUP BY c.id
        `);

        // 5) 计算每个配方的各项得分
        const candidateRecipes = allRecipes
            .filter(r => !preferenceData.interactedRecipeIds.has(r.id));

        const scoredRecipes = [];

        // 获取所有候选配方在相似用户中的受欢迎度（批量查询优化性能）
        const recipeIds = candidateRecipes.map(r => r.id);
        let recipePopularityMap = new Map();

        if (similarUsers.size > 0 && recipeIds.length > 0) {
            const [popularityResults] = await dbPool.query(`
                SELECT 
                    recipe_id AS recipeId,
                    COUNT(DISTINCT user_id) AS userCount
                FROM (
                    SELECT user_id, recipe_id FROM likes
                    UNION ALL
                    SELECT user_id, recipe_id FROM favorites
                ) AS interactions
                WHERE recipe_id IN (?)
                AND user_id IN (?)
                GROUP BY recipe_id
            `, [recipeIds, Array.from(similarUsers.keys())]);

            // 转换为Map便于查找
            popularityResults.forEach(row => {
                recipePopularityMap.set(row.recipeId, row.userCount);
            });
        }

        // 获取实际互动用户的相似度（批量查询优化性能）
        let interactingUsersMap = new Map();
        if (similarUsers.size > 0 && recipeIds.length > 0) {
            const [interactingResults] = await dbPool.query(`
                SELECT 
                    recipe_id AS recipeId,
                    user_id AS userId
                FROM (
                    SELECT recipe_id, user_id FROM likes
                    UNION
                    SELECT recipe_id, user_id FROM favorites
                ) AS interactions
                WHERE recipe_id IN (?)
                AND user_id IN (?)
            `, [recipeIds, Array.from(similarUsers.keys())]);

            // 转换为Map: recipeId -> [userIds]
            interactingResults.forEach(row => {
                if (!interactingUsersMap.has(row.recipeId)) {
                    interactingUsersMap.set(row.recipeId, []);
                }
                interactingUsersMap.get(row.recipeId).push(row.userId);
            });
        }

        // 计算用户平均配方权重（用于原料归一化）
        const avgRecipeWeight = userInteractions.length > 0
            ? Array.from(preferenceData.recipeIngredientWeights.values())
                .reduce((sum, val) => sum + val, 0) / userInteractions.length
            : 1;

        // 遍历所有候选配方计算得分
        for (const recipe of candidateRecipes) {
            const scores = {
                ingredientMatch: 0,
                creatorMatch: 0,
                abvMatch: 0,
                popularity: 0,
                similarUsers: 0
            };
            const matchReasons = [];

            // ——— 5.1 原料匹配 (权重 4) ———
            if (recipe.ingredients) {
                const recipeIngredients = recipe.ingredients.split(',')
                    .map(raw => normalizeIngredient(raw));

                let rawIngredientScore = 0;
                recipeIngredients.forEach(ing => {
                    const w = preferenceData.ingredientWeights.get(ing) || 0;
                    rawIngredientScore += w;
                });

                // 使用平均配方权重进行归一化 + 平滑因子
                const smoothFactor = 0.5;
                scores.ingredientMatch = 4 * (rawIngredientScore / (avgRecipeWeight + smoothFactor));

                // 限制最高得分
                scores.ingredientMatch = Math.min(scores.ingredientMatch, 4);

                // 如果有共同原料，拼一个理由
                const common = recipeIngredients.filter(ing =>
                    preferenceData.ingredientWeights.has(ing));
                if (common.length > 0) {
                    const display = common.slice(0, 3).join('、');
                    matchReasons.push(`可能喜欢的原料: ${display}${common.length > 3 ? '等' : ''}`);
                }
            }

            // ——— 5.2 创建者匹配 (权重 3) ———
            if (recipe.creator && sortedCreators.includes(recipe.creator)) {
                scores.creatorMatch = 3;
                matchReasons.push(`可能喜欢的调酒师: ${recipe.creator}`);
            }

            // ——— 5.3 酒精度匹配 (权重 2) ———
            if (preferenceData.preferredAbv > 0 && recipe.estimatedAbv > 0) {
                const diff = Math.abs(recipe.estimatedAbv - preferenceData.preferredAbv);
                scores.abvMatch = Math.max(0, 2 * (1 - diff / 20));
                // console.log(
                //   `RecipeID=${recipe.id} estAbv=${recipe.estimatedAbv}, prefAbv=${preferenceData.preferredAbv}, diff=${diff}`
                // );
                if (scores.abvMatch > 1.0) {
                    matchReasons.push(`可能喜欢的酒精浓度: ${recipe.estimatedAbv}%`);
                }
            }

            // ——— 5.4 人气 (权重 1.5) ———
            const totalInteractions = recipe.likeCount + recipe.favoriteCount;
            if (totalInteractions > 0) {
                // 限制最高也只能 1.5 分
                scores.popularity = Math.min(1.5, 1.5 * Math.log1p(totalInteractions / 50));
                if (totalInteractions > 10) {
                    matchReasons.push(`热门配方 (已有${totalInteractions}次👍&⭐)`);
                }
            }

            // ——— 5.5 协同过滤 (权重 2.5) ———
            if (similarUsers.size > 0) {
                const userCount = recipePopularityMap.get(recipe.id) || 0;

                // 计算加权得分
                let weightedScore = 0;
                if (userCount > 0) {
                    const userIds = interactingUsersMap.get(recipe.id) || [];
                    userIds.forEach(userId => {
                        const similarity = similarUsers.get(userId) || 0;
                        weightedScore += similarity;
                    });
                }

                // 归一化处理
                const maxPossible = Array.from(similarUsers.values())
                    .reduce((sum, val) => sum + val, 0);

                scores.similarUsers = maxPossible > 0
                    ? 2.5 * (weightedScore / maxPossible)
                    : 0;

                // 根据得分强度生成不同描述
                if (scores.similarUsers > 1) {
                    if (scores.similarUsers > 2.25) {
                        matchReasons.push(`高度相似的用户都喜欢`);
                    } else if (scores.similarUsers > 1.75) {
                        matchReasons.push(`多个相似用户喜欢`);
                    } else {
                        matchReasons.push(`相似用户喜欢`);
                    }
                }
            }

            // 计算总分
            const totalScore =
                scores.ingredientMatch +
                scores.creatorMatch +
                scores.abvMatch +
                scores.popularity +
                scores.similarUsers;

            scoredRecipes.push({
                ...recipe,
                scores,
                totalScore,
                matchReasons
            });
        }

        // 6) 排序 & 取前 MAX_RECOMMENDATIONS 个，拼最终返回格式
        const recommendations = scoredRecipes
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, MAX_RECOMMENDATIONS)
            .map(recipe => {
                const maxPossibleScore = 4 + 3 + 2 + 1.5 + 2.5;
                const matchPercentage = Math.min(
                    100,
                    Math.round((recipe.totalScore / maxPossibleScore) * 100)
                );

                const scoreItems = [
                    {
                        type: "ingredient",
                        weight: 4,
                        reason: recipe.matchReasons.find(r => r.includes("原料")),
                        scoreRate: recipe.scores.ingredientMatch / 4
                    },
                    {
                        type: "creator",
                        weight: 3,
                        reason: recipe.matchReasons.find(r => r.includes("调酒师")),
                        scoreRate: recipe.scores.creatorMatch / 3
                    },
                    {
                        type: "collaborative",
                        weight: 2.5,
                        reason: recipe.matchReasons.find(r => r.includes("相似的用户")),
                        scoreRate: recipe.scores.similarUsers / 2.5
                    },
                    {
                        type: "abv",
                        weight: 2,
                        reason: recipe.matchReasons.find(r => r.includes("酒精浓度")),
                        scoreRate: recipe.scores.abvMatch / 2
                    },
                    {
                        type: "popularity",
                        weight: 1.5,
                        reason: recipe.matchReasons.find(r => r.includes("热门配方")),
                        scoreRate: recipe.scores.popularity / 1.5
                    }
                ];

                const sortedScoreItems = scoreItems
                    .filter(item => item.reason)
                    .sort((a, b) => b.scoreRate - a.scoreRate);

                let reasons = [];
                for (const item of sortedScoreItems) {
                    if (reasons.length < 3 && item.scoreRate > 0.5) {
                        reasons.push(item.reason);
                    }
                }
                if (reasons.length === 0 && recipe.matchReasons.length > 0) {
                    reasons = recipe.matchReasons.slice(0, 3);
                } else if (reasons.length === 0) {
                    reasons = ["您可能喜欢的新配方"];
                }
                const reasonText = reasons.join(" • ");

                return {
                    id: recipe.id,
                    name: recipe.name,
                    estimatedAbv: recipe.estimatedAbv,
                    matchPercentage,
                    reason: reasonText,
                    reasons: reasons
                };
            });

        return res.json({ recommendations });

    } catch (error) {
        console.error("生成推荐失败:", error);
        return res.status(500).json({
            message: "生成推荐时出错",
            error: error.message
        });
    }
});

// ==================== 口味评分和AI分析API ====================

// 评分数据文件路径
const ratingsFilePath = path.join(__dirname, 'data', 'ratings.json');

// 读取评分数据
function readRatings() {
    try {
        if (fsSync.existsSync(ratingsFilePath)) {
            const data = fsSync.readFileSync(ratingsFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('读取评分数据失败:', error);
    }
    return {};
}

// 保存评分数据
function saveRatings(ratings) {
    try {
        const dir = path.dirname(ratingsFilePath);
        if (!fsSync.existsSync(dir)) {
            fsSync.mkdirSync(dir, { recursive: true });
        }
        fsSync.writeFileSync(ratingsFilePath, JSON.stringify(ratings, null, 2), 'utf8');
        console.log(`[评分] 数据已保存到: ${ratingsFilePath}`);
        return true;
    } catch (error) {
        console.error('保存评分数据失败:', error);
        return false;
    }
}

// 获取配方的评分信息
app.get('/api/recipes/:id/ratings', async (req, res) => {
    try {
        const recipeId = req.params.id;
        const ratings = readRatings();
        const recipeRatings = ratings[recipeId];

        if (recipeRatings) {
            res.json({
                success: true,
                hasRating: true,
                ratings: recipeRatings.scores,
                calculatedScore: recipeRatings.calculatedScore,
                aiAnalysis: recipeRatings.aiAnalysis,
                ratedAt: recipeRatings.ratedAt
            });
        } else {
            res.json({
                success: true,
                hasRating: false
            });
        }
    } catch (error) {
        console.error('获取评分失败:', error);
        res.status(500).json({ message: '获取评分失败' });
    }
});

// 保存配方评分和AI分析
app.post('/api/recipes/:id/ratings', async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { scores, aiAnalysis } = req.body;

        // 验证评分数据
        if (!scores || !scores.visual || !scores.aroma || !scores.taste || !scores.mouthfeel || !scores.finish) {
            return res.status(400).json({ message: '请提供完整的评分数据' });
        }

        // 计算加权总分
        // 权重: 外观10%, 香气20%, 风味40%, 口感20%, 余韵10%
        const calculatedScore = (
            scores.visual * 0.1 +
            scores.aroma * 0.2 +
            scores.taste * 0.4 +
            scores.mouthfeel * 0.2 +
            scores.finish * 0.1
        ).toFixed(1);

        const ratings = readRatings();
        ratings[recipeId] = {
            scores: scores,
            calculatedScore: parseFloat(calculatedScore),
            aiAnalysis: aiAnalysis || null,
            ratedAt: new Date().toISOString()
        };

        if (saveRatings(ratings)) {
            res.json({
                success: true,
                calculatedScore: parseFloat(calculatedScore),
                message: '评分保存成功'
            });
        } else {
            res.status(500).json({ message: '保存评分失败' });
        }
    } catch (error) {
        console.error('保存评分失败:', error);
        res.status(500).json({ message: '保存评分失败' });
    }
});

// 基于配方ID进行AI口味分析
app.post('/api/recipes/:id/ai-analyze', async (req, res) => {
    try {
        const recipeId = req.params.id;
        console.log(`[AI分析] 开始分析配方ID: ${recipeId}`);

        // 获取配方详情
        let recipes;
        try {
            [recipes] = await dbPool.query(
                'SELECT id, name, instructions, estimated_abv FROM cocktails WHERE id = ?',
                [recipeId]
            );
            console.log(`[AI分析] 查询到配方数量: ${recipes.length}`);
        } catch (dbError) {
            console.error('[AI分析] 数据库查询配方失败:', dbError.message);
            return res.status(500).json({ message: '数据库查询失败' });
        }

        if (recipes.length === 0) {
            return res.status(404).json({ message: '配方不存在' });
        }

        const recipe = recipes[0];
        console.log(`[AI分析] 配方名称: ${recipe.name}`);

        // 获取配方原料
        let ingredients;
        try {
            [ingredients] = await dbPool.query(
                'SELECT name, volume, abv FROM ingredients WHERE cocktail_id = ?',
                [recipeId]
            );
            console.log(`[AI分析] 查询到原料数量: ${ingredients.length}`);
        } catch (dbError) {
            console.error('[AI分析] 数据库查询原料失败:', dbError.message);
            return res.status(500).json({ message: '数据库查询失败' });
        }

        if (ingredients.length === 0) {
            // 如果没有原料，使用配方的基本信息进行分析
            console.log('[AI分析] 配方没有原料信息，使用基本信息分析');
        }

        // 构建分析提示
        const ingredientsList = ingredients.map(ing =>
            `${ing.name} (${ing.volume}ml, 酒精度: ${ing.abv || 0}%)`
        ).join(', ');

        const prompt = `请对以下鸡尾酒进行专业的口味分析：

鸡尾酒名称: ${recipe.name}
预估酒精度: ${recipe.estimated_abv || '未知'}%
原料: ${ingredientsList}
制作方法: ${recipe.instructions || '未提供'}

请按照以下格式提供详细分析：

【综合评分建议】
外观呈现: X/10 (颜色、透明度、装饰等)
香气表现: X/10 (初闻、复杂性、酒精融合度)
风味平衡: X/10 (酸甜平衡、苦味整合、融合度)
口感体验: X/10 (温度、稀释度、质地)
余韵持久: X/10 (持久度、愉悦感)

【口味特征】
甜度: X/5
酸度: X/5
苦度: X/5
烈度: X/5
清爽度: X/5

【详细分析】
1. 外观与呈现分析
2. 香气层次解析
3. 风味平衡评价
4. 口感与酒体描述
5. 余韵与回味分析
6. 适饮场景推荐
7. 改进建议(如有)

请用专业但易懂的语言，给出客观准确的分析。

注意：请不要使用任何Markdown格式符号（如**、*、#、-等），直接输出纯文本内容。`;

        let analysis;
        const aiProvider = process.env.AI_PROVIDER;
        const qwenKey = process.env.QWEN_API_KEY;
        const deepseekKey = process.env.DEEPSEEK_API_KEY;

        if (!qwenKey && !deepseekKey) {
            // 演示模式
            analysis = `🤖 AI口味分析结果

【综合评分建议】
外观呈现: 8/10 - 色泽诱人，视觉效果良好
香气表现: 7/10 - 香气层次丰富
风味平衡: 8/10 - 酸甜适中，融合度高
口感体验: 8/10 - 口感顺滑，温度适宜
余韵持久: 7/10 - 回味悠长

【口味特征】
甜度: 3/5 - 适中的甜度
酸度: 2/5 - 清爽的酸度
苦度: 1/5 - 微苦回甘
烈度: 3/5 - 酒精感适中
清爽度: 4/5 - 清爽解腻

【详细分析】

**外观与呈现：**
这款${recipe.name}呈现出优雅的色泽，透明度良好。建议搭配合适的杯具和装饰物，提升整体视觉体验。

**香气层次：**
前调带有明显的酒精香气和原料特征香，中调展现出丰富的风味层次，后调留有淡淡的果香或草本香气。

**风味平衡：**
酸甜比例协调，各种原料的风味相互融合而非冲突，整体呈现出和谐统一的口感。

**口感与酒体：**
入口顺滑，酒体中等偏轻，酒精感被很好地掩盖，适合细细品味。

**余韵分析：**
回味持久，留下愉悦的果香或木质香气，令人回味无穷。

**适饮场景：**
适合休闲聚会、晚餐后饮用，或作为开胃酒。

⚠️ 这是演示模式的分析结果。配置API密钥后可获得更精准的AI分析。`;
        } else if (aiProvider === 'qwen' && qwenKey) {
            // 调用阿里云千问API (响应更快)
            console.log('[AI分析] 使用千问Turbo模型');
            const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                model: 'qwen-plus',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位资深的调酒师和品酒专家，拥有丰富的鸡尾酒品鉴经验。请用专业、客观的语言分析鸡尾酒的口味特征。'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1500
            }, {
                headers: {
                    'Authorization': `Bearer ${qwenKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            analysis = response.data.choices[0].message.content;
        } else if (deepseekKey) {
            // 调用DeepSeek API
            console.log('[AI分析] 使用DeepSeek模型');
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位资深的调酒师和品酒专家，拥有丰富的鸡尾酒品鉴经验。请用专业、客观的语言分析鸡尾酒的口味特征。'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1500
            }, {
                headers: {
                    'Authorization': `Bearer ${deepseekKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });
            analysis = response.data.choices[0].message.content;
        }

        // 保存分析结果到评分数据
        const ratings = readRatings();
        if (!ratings[recipeId]) {
            ratings[recipeId] = {};
        }
        ratings[recipeId].aiAnalysis = analysis;
        ratings[recipeId].analyzedAt = new Date().toISOString();
        saveRatings(ratings);

        res.json({
            success: true,
            analysis: analysis,
            analyzedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('[AI分析] 错误详情:', error);
        console.error('[AI分析] 错误信息:', error.message);
        if (error.response) {
            console.error('[AI分析] 响应状态:', error.response.status);
            console.error('[AI分析] 响应数据:', error.response.data);
            if (error.response.status === 402) {
                return res.status(402).json({ message: 'API余额不足' });
            }
        }
        res.status(500).json({ message: `AI分析服务暂时不可用: ${error.message}` });
    }
});
