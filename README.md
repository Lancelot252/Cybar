# Cybar - 智能鸡尾酒配方管理平台

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v14+-green.svg)
![Express](https://img.shields.io/badge/express-~4.17.1-orange.svg)

## 📖 项目简介

Cybar是一个功能丰富的鸡尾酒配方管理和酒精度计算平台，集成了多种先进功能来为调酒爱好者和专业调酒师提供完整的数字化解决方案。该项目采用现代化的网页技术栈，提供直观友好的用户体验，并集成了AI智能推荐功能。

## 🚨 重要：AI密钥配置

**在使用AI智能推荐功能之前，您需要配置Deepseek API密钥：**

### 快速配置（推荐）
```bash
# Windows用户 - 运行配置脚本
setup-api-key.bat

# 或者使用PowerShell
powershell -ExecutionPolicy Bypass -File setup-api-key.ps1
```

### 手动配置
1. 访问 [Deepseek平台](https://platform.deepseek.com) 获取API密钥
2. 创建 `config.json` 文件：
```json
{
  "DEEPSEEK_API_KEY": "sk-your-real-api-key-here"
}
```

### 验证配置
运行服务器后查看输出：
- ✅ `🤖 AI功能: ✅ 已配置` - 配置成功
- ❌ `🤖 AI功能: ❌ 未配置 (演示模式)` - 需要配置

📖 详细配置指南请查看：[AI_CONFIG_SETUP.md](AI_CONFIG_SETUP.md)

## ✨ 核心功能特点

### 🍸 配方管理系统
- **配方浏览**：分页展示鸡尾酒配方列表，包含创建者信息和基本配方数据
- **配方详情**：详细的配方展示页面，包含完整配料列表、制作步骤、酒精度信息
- **高级搜索**：支持按配方名称、创建者、酒精度范围进行精确搜索
- **智能排序**：支持按创建时间、点赞数、收藏数、名称、酒精度多维度排序
- **预设配方库**：内置经典鸡尾酒配方，包含马提尼、莫吉托、血腥玛丽等知名鸡尾酒

### 🎨 自定义配方创建器
- **可视化原料选择**：直观的分类标签和搜索功能，支持多种原料类型
- **实时酒精度计算**：在添加原料时实时计算和显示鸡尾酒的预估酒精度
- **3D可视化模拟**：动态显示调酒过程的可视化效果
- **丰富原料库**：包含基酒、利口酒、果汁、苦精、装饰等多个分类的原料
- **配方保存功能**：用户可保存自定义配方到个人收藏（需要登录）
### 👤 用户系统与认证
- **用户注册登录**：完整的用户认证系统，支持用户注册、登录、会话管理
- **角色权限管理**：区分普通用户和管理员权限，实现分级访问控制
- **个人用户中心**：展示用户的点赞历史、收藏列表、创建配方记录

### 💬 社交互动功能
- **评论系统**：用户可以对配方发表评论，查看其他用户的评论和反馈
- **点赞收藏**：支持对配方进行点赞和收藏操作，建立用户偏好数据
- **AI智能推荐**：基于用户行为和偏好的协同过滤推荐算法

### 🧮 专业计算工具
- **精确酒精度计算器**：独立的酒精度计算工具，支持复杂混合饮料的酒精含量计算
- **原料体积比例计算**：自动计算各种原料的最佳配比

### 🛠️ 后台管理系统
- **管理员控制面板**：完整的后台管理界面，包含统计数据可视化
- **用户管理**：管理员可以查看、删除用户，修改用户角色权限
- **配方管理**：管理员可以管理所有配方，包括删除不当内容
- **评论管理**：管理员可以查看和删除用户评论
- **数据统计**：页面访问统计图表，用户和配方数量统计

## 🚀 技术栈

### 前端技术
- **HTML5 & CSS3**：现代化的网页结构和样式设计
- **原生JavaScript**：高性能的前端交互逻辑
- **Chart.js**：用于管理后台的数据可视化图表
- **Font Awesome**：图标库提供丰富的UI图标
- **响应式设计**：支持移动端和桌面端的完美适配

### 后端技术
- **Node.js**：服务器端运行环境
- **Express.js**：轻量级Web应用框架
- **express-session**：会话管理中间件
- **MySQL2**：MySQL数据库连接驱动

### 数据存储
- **MySQL数据库**：主要数据存储，包含用户、配方、评论、点赞、收藏等数据
- **JSON文件**：部分配置和静态数据存储

### AI与外部服务
- **Deepseek API**：AI智能推荐服务
- **Axios**：HTTP客户端用于API调用

## 📋 部署指南

### 📦 环境要求
- **Node.js** (v14.0.0或更高版本)
- **npm** (v6.0.0或更高版本)  
- **MySQL** (v5.7或更高版本)
- **Git** (用于克隆项目)

### 🚀 完整部署步骤

#### 第一步：获取项目代码
```bash
# 克隆项目仓库
git clone https://github.com/yourusername/Cybar.git
cd Cybar

# 或者直接下载源码包并解压到目标目录
```

#### 第二步：安装项目依赖
```bash
# 使用npm安装所有依赖包
npm install

# 如果遇到网络问题，可以使用淘宝镜像
npm install --registry https://registry.npmmirror.com
```

#### 第三步：MySQL数据库配置

**3.1 创建数据库**
```sql
-- 连接到MySQL服务器
mysql -u root -p

-- 创建数据库
CREATE DATABASE cybar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 选择数据库
USE cybar;

-- 退出MySQL命令行
EXIT;
```

**3.2 导入数据库结构和数据**
```bash
# 在项目根目录执行，导入完整的数据库结构和示例数据
mysql -u root -p cybar < cybar.sql
```

**3.3 配置数据库连接**

在 `server.js` 文件中找到数据库连接配置部分（约第53-60行）：

```javascript
// 数据库连接池配置
const dbPool = mysql.createPool({
    host: 'localhost',        // 数据库主机地址
    user: 'root',            // 数据库用户名
    password: 'your_password', // 修改为您的MySQL密码
    database: 'cybar',       // 数据库名称
    port: 3306,              // MySQL端口号
    charset: 'utf8mb4'       // 字符集
});
```

请根据您的MySQL配置修改以下信息：
- `host`: 如果MySQL不在本机，请修改为实际的主机地址
- `user`: 您的MySQL用户名
- `password`: 您的MySQL密码  
- `port`: 如果MySQL端口不是3306，请修改为实际端口

#### 第四步：配置AI智能推荐服务（可选但推荐）

**4.1 获取Deepseek API密钥**
1. 访问 [Deepseek平台](https://platform.deepseek.com)
2. 注册/登录账户
3. 在控制台中创建API密钥

**4.2 配置API密钥（推荐方法）**
```bash
# Windows用户 - 运行自动配置脚本
setup-api-key.bat

# 或手动创建配置文件
echo {> config.json
echo   "DEEPSEEK_API_KEY": "sk-your-real-api-key-here">> config.json
echo }>> config.json
```

**4.3 环境变量方式配置（可选）**
```bash
# Windows PowerShell
$env:DEEPSEEK_API_KEY="sk-your-real-api-key-here"

# Windows CMD  
set DEEPSEEK_API_KEY=sk-your-real-api-key-here

# Linux/Mac
export DEEPSEEK_API_KEY="sk-your-real-api-key-here"
```

#### 第五步：启动服务器

```bash
# 启动Cybar服务器
npm start

# 或者直接使用Node.js
node server.js
```

**启动成功标志：**
```
========================================
🚀 Cybar 服务器启动成功
📍 访问地址: http://localhost:8080
🤖 AI功能: ✅ 已配置 (sk-xxxxxxxx...)
========================================
```

#### 第六步：访问应用

在浏览器中打开：http://localhost:8080

### 🔑 默认管理员账户

项目包含预配置的管理员账户，用于系统管理：

**管理员账户信息：**
- 用户名：`252`
- 密码：`252`
- 权限：管理员（admin）

**⚠️ 重要安全提醒：**
- 生产环境部署前，请立即修改默认密码
- 建议创建新的管理员账户后删除默认账户
- 可通过后台管理面板修改用户信息和权限

### 📊 预置数据说明

数据库包含以下预置内容：
- **示例用户账户**：多个测试用户和管理员账户
- **经典配方**：5个预设的经典鸡尾酒配方
- **用户互动数据**：示例点赞、收藏、评论数据
- **原料数据库**：完整的鸡尾酒原料分类和信息

### 🔧 生产环境部署

#### 使用PM2进程管理器（推荐）
```bash
# 全局安装PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name "cybar"

# 查看应用状态
pm2 status

# 设置开机自启
pm2 startup
pm2 save
```

#### 使用Docker部署
```dockerfile
# Dockerfile示例
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
EXPOSE 8080

CMD ["node", "server.js"]
```

```bash
# 构建和运行Docker容器
docker build -t cybar .
docker run -d -p 8080:8080 --name cybar-app cybar
```

#### 反向代理配置（Nginx示例）
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 🛡️ 安全配置建议

#### 1. 数据库安全
```sql
-- 创建专用数据库用户
CREATE USER 'cybar_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT SELECT, INSERT, UPDATE, DELETE ON cybar.* TO 'cybar_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 2. 应用安全配置
在 `server.js` 中修改会话密钥：
```javascript
app.use(session({
    secret: 'your-very-strong-secret-key-here', // 修改为强密码
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: true,    // HTTPS环境下设置为true
        httpOnly: true,  // 防止XSS攻击
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));
```

#### 3. 防火墙设置
```bash
# Ubuntu/Debian
sudo ufw allow 8080
sudo ufw enable

# CentOS/RHEL  
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### 📋 部署检查清单

- [ ] Node.js和npm已安装并版本正确
- [ ] MySQL服务运行正常  
- [ ] 数据库`cybar`已创建并导入数据
- [ ] `server.js`中数据库连接配置正确
- [ ] 项目依赖已安装（`npm install`）
- [ ] AI API密钥已配置（可选）
- [ ] 防火墙端口8080已开放
- [ ] 服务器启动成功，控制台显示正常日志
- [ ] 浏览器可正常访问 http://localhost:8080
- [ ] 用户注册/登录功能正常
- [ ] 数据库读写操作正常
- [ ] 静态资源加载正常

### 🚨 常见部署问题解决

#### 问题1：数据库连接失败
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**解决方案：**
- 检查MySQL服务是否启动
- 验证数据库连接配置是否正确
- 确保防火墙允许3306端口

#### 问题2：端口被占用
```
Error: listen EADDRINUSE :::8080
```
**解决方案：**
```bash
# 查找占用端口的进程
netstat -ano | findstr :8080  # Windows
lsof -i :8080                 # Linux/Mac

# 终止进程或更改端口号
```

#### 问题3：npm install失败
**解决方案：**
```bash
# 清理npm缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules
npm install

# 使用国内镜像
npm install --registry https://registry.npmmirror.com
```

#### 问题4：AI功能无法使用
**解决方案：**
- 检查API密钥是否正确配置
- 确认Deepseek API账户余额充足
- 验证网络连接是否正常

### 📞 技术支持

如果遇到部署问题，请：
1. 查阅详细的错误日志
2. 参考 [AI_CONFIG_SETUP.md](AI_CONFIG_SETUP.md) 获取AI配置帮助
3. 在GitHub Issues中反馈问题

## 🎯 使用方法

### 启动服务器
```bash
npm start
# 或者
node server.js
```

服务器将在 http://localhost:8080 启动。

### 功能访问指南

1. **🏠 主页访问**：http://localhost:8080/
   - 项目介绍和功能导航

2. **🍸 配方浏览**：http://localhost:8080/recipes/
   - 浏览所有鸡尾酒配方（分页显示）
   - 查看配方详情、评论和互动

3. **🎨 自定义调酒**：http://localhost:8080/custom/
   - 使用可视化界面创建自定义鸡尾酒配方
   - 实时预览和酒精度计算

4. **🧮 酒精度计算器**：http://localhost:8080/calculator/
   - 独立的酒精度计算工具

5. **👤 用户认证**：
   - 注册：http://localhost:8080/auth/register/
   - 登录：http://localhost:8080/auth/login/

6. **👤 个人中心**：http://localhost:8080/profile/
   - 查看个人点赞、收藏、创建历史（需要登录）

7. **🛠️ 后台管理**：http://localhost:8080/admin/
   - 管理员专用控制面板（需要管理员权限）

## 🔌 API 接口文档

### 配方相关接口
- `GET /api/recipes?page=<page>&limit=<limit>&sort=<sort>&search=<search>` - 获取配方列表（分页+搜索+排序）
- `GET /api/recipes/:id` - 获取单个配方详情
- `DELETE /api/recipes/:id` - 删除配方（需要管理员权限）

### 自定义调酒接口
- `GET /api/custom/ingredients` - 获取原料数据
- `POST /api/custom/cocktails` - 保存自定义鸡尾酒配方（需要登录）
- `GET /api/custom/cocktails` - 获取自定义配方列表

### 用户交互接口
- `POST /api/recipes/:id/like` - 点赞/取消点赞配方（需要登录）
- `POST /api/recipes/:id/favorite` - 收藏/取消收藏配方（需要登录）
- `GET /api/recipes/:id/interactions` - 获取配方互动状态（需要登录）

### 评论系统接口
- `GET /api/recipes/:id/comments` - 获取配方评论
- `POST /api/recipes/:id/comments` - 添加评论（需要登录）
- `DELETE /api/comments/:commentId` - 删除评论（需要管理员权限）

### 用户认证接口
- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录
- `POST /api/logout` - 用户注销
- `GET /api/auth/status` - 获取登录状态

### 个人中心接口
- `GET /api/user/current` - 获取当前用户信息（需要登录）
- `GET /api/user/likes` - 获取用户点赞历史（需要登录）
- `GET /api/user/favorites` - 获取用户收藏历史（需要登录）
- `GET /api/user/created-recipes` - 获取用户创建的配方（需要登录）

### AI智能推荐接口
- `GET /api/recommendations` - 获取个性化推荐配方（需要登录）
- `POST /api/custom/generate-recipe` - AI智能调酒师生成配方
- `POST /api/custom/analyze-taste` - AI口味分析

### 管理员接口
- `GET /api/admin/stats` - 获取后台统计数据（需要管理员权限）
- `GET /api/admin/users?page=<page>&limit=<limit>` - 获取用户列表（需要管理员权限）
- `DELETE /api/admin/users/:userId` - 删除用户（需要管理员权限）
- `PUT /api/admin/users/:userId/role` - 修改用户角色（需要管理员权限）
- `GET /api/admin/comments?page=<page>&limit=<limit>` - 获取所有评论（需要管理员权限）

### 📝 API使用说明

#### 认证方式
- 使用Express Session进行用户认证
- 登录后会话信息存储在服务器端
- 前端通过Cookie自动携带会话ID

#### 数据格式
- 请求和响应均采用JSON格式
- 请求头需设置 `Content-Type: application/json`
- 时间戳采用ISO 8601格式

#### 错误处理
- HTTP状态码标准化：200成功，400客户端错误，401未授权，403禁止，404未找到，500服务器错误
- 错误响应格式：`{"message": "错误描述"}`

#### 分页参数
- `page`: 页码（从1开始）
- `limit`: 每页数量（默认10）
- 响应包含：`totalItems`, `totalPages`, `currentPage`, `data`

#### 排序选项（配方接口）
- `date`: 按创建时间排序（默认）
- `likes`: 按点赞数排序
- `favorites`: 按收藏数排序  
- `name`: 按名称排序
- `abv`: 按酒精度排序

## 📁 项目结构

```
Cybar/
├── 🗂️ admin/                      # 后台管理界面
│   ├── index.html                 # 管理员控制面板
│   ├── admin.css                  # 管理面板样式
│   └── admin.js                   # 管理员功能实现
├── 🗂️ auth/                       # 用户认证功能
│   ├── login.html                 # 用户登录页面
│   ├── register.html              # 用户注册页面
│   └── auth.js                    # 认证逻辑处理
├── 🗂️ calculator/                 # 酒精度计算功能
│   ├── index.html                 # 酒精度计算器页面
│   └── calculator.js              # 计算逻辑实现
├── 🗂️ custom/                     # 自定义配方创建器
│   ├── index.html                 # 自定义调酒主页面
│   ├── custom.js                  # 主要交互逻辑
│   ├── cocktail-simulation.css    # 3D可视化样式
│   ├── cocktail-simulation.js     # 可视化动画逻辑
│   ├── ingredients.json           # 原料数据库
│   ├── preset_cocktails.json      # 预设配方数据
│   ├── custom_cocktails.json      # 用户自定义配方存储
│   └── 🗂️ components/             # 组件文件
│       ├── ingredients-selector.js
│       ├── gridview-selector.js
│       └── grid-to-list.js
├── 🗂️ js/                         # 全局JavaScript
│   └── global.js                  # 全局功能和导航
├── 🗂️ profile/                    # 用户个人中心
│   ├── index.html                 # 个人中心页面
│   ├── profile.css                # 个人中心样式
│   └── profile.js                 # 个人中心逻辑
├── 🗂️ recipes/                    # 配方展示功能
│   ├── index.html                 # 配方列表页面
│   ├── detail.html                # 配方详情页面
│   ├── recipes.js                 # 配方列表逻辑
│   └── detail.js                  # 配方详情和评论功能
├── 📄 index.html                  # 网站主页
├── 📄 server.js                   # Node.js服务器入口
├── 📄 package.json                # 项目依赖配置
├── 📄 style.css                   # 全局样式文件
├── 📄 script.js                   # 主页脚本
├── 📄 cybar.sql                   # MySQL数据库结构和数据
├── 📊 数据文件/
│   ├── users.json                 # 用户数据（备用存储）
│   ├── recipes.json               # 配方数据（备用存储）
│   ├── comments.json              # 评论数据（备用存储）
│   ├── likes.json                 # 点赞数据（备用存储）
│   └── favorites.json             # 收藏数据（备用存储）
├── 🔧 配置文件/
│   ├── config.json.example        # API密钥配置示例
│   ├── setup-api-key.bat          # Windows API密钥配置脚本
│   └── setup-api-key.ps1          # PowerShell API密钥配置脚本
├── 📖 文档文件/
│   ├── README.md                  # 项目主文档
│   ├── AI_CONFIG_SETUP.md         # AI配置详细指南
│   └── AI_CONFIGURATION_FIXED.md  # AI配置问题修复说明
└── 🗃️ 项目元数据/
    ├── .gitignore                 # Git忽略文件配置
    └── LICENSE                    # 开源协议文件
```

### 🏗️ 核心架构说明

#### 前端架构
- **多页面应用（MPA）**：每个功能模块都有独立的HTML页面
- **模块化设计**：JavaScript按功能分离，便于维护和扩展
- **响应式布局**：支持桌面端和移动端的完美适配
- **原生技术栈**：使用原生HTML、CSS、JavaScript，无复杂框架依赖

#### 后端架构  
- **Node.js + Express**：轻量级Web服务器框架
- **MySQL数据库**：主要数据存储，包含完整的关系数据模型
- **会话管理**：基于express-session的用户认证系统
- **RESTful API**：标准的REST API设计，支持JSON数据交换

#### 数据存储
- **主数据库（MySQL）**：
  - `users` - 用户信息和权限管理
  - `cocktails` - 鸡尾酒配方核心数据
  - `ingredients` - 配方原料明细
  - `comments` - 用户评论和互动
  - `likes` - 点赞记录
  - `favorites` - 收藏记录
- **备用存储（JSON文件）**：配置数据和缓存

#### 功能模块
1. **用户认证系统** (`/auth/`)：注册、登录、权限管理
2. **配方浏览系统** (`/recipes/`)：分页展示、搜索、详情查看
3. **自定义调酒器** (`/custom/`)：可视化配方创建、3D模拟
4. **个人中心** (`/profile/`)：用户数据、历史记录
5. **后台管理** (`/admin/`)：数据统计、用户管理、内容审核
6. **酒精度计算器** (`/calculator/`)：独立计算工具
7. **AI智能推荐**：基于用户偏好的个性化推荐

## 🔧 开发指南

### 添加新功能
1. **前端页面**：在相应目录创建HTML、CSS、JS文件
2. **API接口**：在 `server.js` 中添加新的路由和中间件
3. **权限控制**：使用 `isAuthenticated` 和 `isAdmin` 中间件
4. **数据库操作**：使用MySQL连接池进行数据操作
5. **文档更新**：及时更新README.md和相关文档

### 代码规范
- **语义化HTML**：使用恰当的HTML5标签
- **模块化CSS**：使用类选择器，避免过度嵌套
- **现代JavaScript**：使用ES6+语法，async/await处理异步
- **错误处理**：完善的异常捕获和用户友好的错误提示
- **注释文档**：关键功能和复杂逻辑需要详细注释

### 数据库设计
项目使用MySQL作为主数据库，主要包含以下表结构：
- **users** - 用户信息表
- **cocktails** - 鸡尾酒配方表
- **ingredients** - 配方原料表
- **comments** - 评论表
- **likes** - 点赞记录表
- **favorites** - 收藏记录表

## 🤝 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

1. **Fork项目** - 创建您自己的项目副本
2. **创建特性分支** - `git checkout -b feature/amazing-feature`
3. **提交更改** - `git commit -m 'Add some amazing feature'`
4. **推送到分支** - `git push origin feature/amazing-feature`
5. **创建Pull Request** - 详细描述您的更改内容

### 贡献类型
- 🐛 Bug修复
- ✨ 新功能开发
- 📝 文档改进
- 🎨 UI/UX优化
- ⚡ 性能优化
- 🔧 代码重构

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 👨‍💻 开发团队

- **主要开发者**: 252
- **项目维护**: GitHub Community
- **技术支持**: [Issues](https://github.com/yourusername/Cybar/issues)

## 🙏 致谢

感谢所有为Cybar项目做出贡献的开发者和用户。特别感谢：
- Deepseek提供的AI服务支持
- Chart.js团队提供的数据可视化解决方案
- Font Awesome团队提供的图标库
- Express.js和Node.js社区的技术支持

---
<div align="center">

**🍸 享受您的调酒之旅！**

*如果您喜欢这个项目，请给我们一个⭐️*

</div>

