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
- **预设配方库**：内置经典鸡尾酒配方，包含马提尼、莫吉托、血腥玛丽等知名鸡尾酒

### 🎨 自定义配方创建器
- **可视化原料选择**：直观的分类标签和搜索功能，支持多种原料类型
- **实时酒精度计算**：在添加原料时实时计算和显示鸡尾酒的预估酒精度
- **3D可视化模拟**：动态显示调酒过程的可视化效果
- **丰富原料库**：包含基酒、利口酒、果汁、苦精、装饰等多个分类的原料
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

## 📋 安装指南

### 环境要求
- **Node.js** (v14.0.0或更高版本)
- **npm** (v6.0.0或更高版本)
- **MySQL** (v5.7或更高版本)

### 安装步骤

1. **克隆项目仓库**
```bash
git clone https://github.com/yourusername/Cybar.git
cd Cybar
```

2. **安装项目依赖**
```bash
npm install
```

3. **数据库配置**
- 创建MySQL数据库 `cybar`
- 修改 `server.js` 中的数据库连接配置
- 运行相应的数据库初始化脚本（如果有）

4. **配置AI服务（可选）**
- 按照上述AI密钥配置说明设置Deepseek API密钥

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
- `GET /api/recipes?page=<page>&limit=<limit>` - 获取配方列表（分页）
- `GET /api/recipes/:id` - 获取单个配方详情
- `POST /api/recipes` - 添加新配方（需要登录）
- `DELETE /api/recipes/:id` - 删除配方（需要管理员权限）

### 自定义调酒接口
- `GET /api/custom/ingredients` - 获取原料数据
- `POST /api/custom/cocktails` - 保存自定义鸡尾酒配方
- `GET /api/custom/cocktails` - 获取自定义配方列表

### 用户交互接口
- `POST /api/recipes/:id/like` - 点赞/取消点赞配方
- `POST /api/recipes/:id/favorite` - 收藏/取消收藏配方
- `GET /api/recipes/:id/interactions` - 获取配方互动状态

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
- `GET /api/user/current` - 获取当前用户信息
- `GET /api/user/likes` - 获取用户点赞历史
- `GET /api/user/favorites` - 获取用户收藏历史
- `GET /api/user/created-recipes` - 获取用户创建的配方

### AI推荐接口
- `GET /api/recommendations` - 获取个性化推荐配方

### 管理员接口
- `GET /api/admin/stats` - 获取后台统计数据（需要管理员权限）
- `GET /api/admin/users` - 获取用户列表（需要管理员权限）
- `DELETE /api/admin/users/:userId` - 删除用户（需要管理员权限）
- `PUT /api/admin/users/:userId/role` - 修改用户角色（需要管理员权限）
- `GET /api/admin/comments` - 获取所有评论（需要管理员权限）

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
├── 📊 数据文件/
│   ├── users.json                 # 用户数据（备用）
│   ├── recipes.json               # 配方数据（备用）
│   ├── comments.json              # 评论数据（备用）
│   ├── likes.json                 # 点赞数据（备用）
│   └── favorites.json             # 收藏数据（备用）
├── 🔧 配置文件/
│   ├── config.json.example        # API密钥配置示例
│   ├── setup-api-key.bat          # Windows API密钥配置脚本
│   └── setup-api-key.ps1          # PowerShell API密钥配置脚本
└── 📖 README.md                   # 项目文档
```

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

