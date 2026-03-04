// 自动配置AI密钥
const fs = require('fs').promises;
const fsSync = require('fs');
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

// 项目根目录 (server 的上级目录)
const ROOT_DIR = path.join(__dirname, '..');

// 从配置文件获取
const configFile = path.join(ROOT_DIR, 'config.json');

if (fsSync.existsSync(configFile)) {
    try {
        const config = JSON.parse(fsSync.readFileSync(configFile, 'utf8'));

        // 加载 DEEPSEEK API KEY
        if (config.DEEPSEEK_API_KEY && config.DEEPSEEK_API_KEY !== 'sk-your-api-key-here') {
            deepseekApiKey = config.DEEPSEEK_API_KEY;
            console.log('🤖 从配置文件加载了 DeepSeek AI 密钥');
        }

        // 加载 QWEN API KEY
        if (config.QWEN_API_KEY && config.QWEN_API_KEY !== 'sk-your-api-key-here') {
            qwenApiKey = config.QWEN_API_KEY;
            console.log('🤖 从配置文件加载了 Qwen AI 密钥');
        }
    } catch (error) {
        console.log('⚠️ 配置文件读取失败:', error.message);
    }
}

// 设置API密钥到环境变量
if (deepseekApiKey) {
    process.env.DEEPSEEK_API_KEY = deepseekApiKey;
    console.log('🤖 已配置 DeepSeek AI 密钥环境变量');
}

if (qwenApiKey) {
    process.env.QWEN_API_KEY = qwenApiKey;
    console.log('🤖 已配置 Qwen AI 密钥环境变量');
}

if (!deepseekApiKey && !qwenApiKey) {
    console.log('⚠️ 未找到有效的AI密钥，将使用演示模式');
    console.log('   请在config.json文件中配置{"DEEPSEEK_API_KEY": "您的密钥"} 或 {"QWEN_API_KEY": "您的密钥"}');
}

const express = require('express');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const recipesRoutes = require('./routes/recipes');
const userRoutes = require('./routes/user');
const customRoutes = require('./routes/custom');
const recommendationsRoutes = require('./routes/recommendations');

const app = express();


// 静态文件服务（从项目根目录提供）
app.use(express.static(ROOT_DIR));

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session配置
app.use(session({
    secret: process.env.SESSION_SECRET || 'your secret key', // 建议使用环境变量
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // 生产环境中使用 HTTPS 时设为 true
}));

// --- 页面访问计数中间件 ---
const pageVisitCounts = {
    '/': 0,
    '/recipes/': 0,
    '/calculator/': 0,
    '/admin/': 0,
};

app.use((req, res, next) => {
    const pathKey = req.path.endsWith('/') ? req.path : req.path + '/';
    if (req.method === 'GET' && pageVisitCounts.hasOwnProperty(pathKey)) {
        pageVisitCounts[pathKey]++;
        console.log(`Visit counts: ${JSON.stringify(pageVisitCounts)}`);
    }
    next();
});

app.use('/', authRoutes);
app.use('/', adminRoutes);
app.use('/', recipesRoutes);
app.use('/', userRoutes);
app.use('/', customRoutes);
app.use('/', recommendationsRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// --- 导出 ---
module.exports = app;
module.exports.pageVisitCounts = pageVisitCounts;
