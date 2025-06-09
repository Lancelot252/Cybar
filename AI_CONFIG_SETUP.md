# AI密钥配置指南

## 🎯 问题解决
这个指南帮助您正确配置Deepseek AI密钥，解决AI功能无法正常工作的问题。

## 🔑 获取API密钥

1. **访问Deepseek平台**
   - 打开 https://platform.deepseek.com
   - 注册账号并登录

2. **创建API密钥**
   - 在控制台中找到"API密钥"或"API Keys"选项
   - 点击"创建新密钥"或"Create New Key"
   - 复制生成的密钥（格式类似：`sk-xxxxxxxxxxxxxxxxxx`）

## 🛠️ 配置方法

### 方法1：使用配置文件（推荐）

1. **复制示例配置文件**
   ```bash
   copy config.json.example config.json
   ```

2. **编辑config.json文件**
   ```json
   {
     "DEEPSEEK_API_KEY": "sk-your-real-api-key-here"
   }
   ```

3. **将示例密钥替换为您的真实密钥**

### 方法2：使用环境变量

1. **Windows PowerShell**
   ```powershell
   $env:DEEPSEEK_API_KEY="sk-your-real-api-key-here"
   node server.js
   ```

2. **Windows CMD**
   ```cmd
   set DEEPSEEK_API_KEY=sk-your-real-api-key-here
   node server.js
   ```

3. **Linux/Mac**
   ```bash
   export DEEPSEEK_API_KEY="sk-your-real-api-key-here"
   node server.js
   ```

### 方法3：使用.env文件

1. **创建.env文件**
   ```
   DEEPSEEK_API_KEY=sk-your-real-api-key-here
   ```

2. **确保.env文件在项目根目录**

## ✅ 验证配置

运行服务器后，查看输出信息：

**✅ 成功配置的输出：**
```
🤖 从配置文件加载了AI密钥
🤖 已配置AI密钥环境变量
========================================
🚀 Cybar 服务器启动成功
📍 访问地址: http://localhost:8080
🤖 AI功能: ✅ 已配置 (sk-xxxxxxxx...)
========================================
```

**❌ 未配置或配置错误的输出：**
```
⚠️ 未找到有效的AI密钥，将使用演示模式
   请在环境变量DEEPSEEK_API_KEY中设置您的API密钥
   或在config.json文件中配置{"DEEPSEEK_API_KEY": "您的密钥"}
🤖 AI功能: ❌ 未配置 (演示模式)
```

## 📋 常见问题

### Q: API密钥格式是什么？
A: Deepseek的API密钥格式为：`sk-` 开头，后面跟随一串字母数字组合

### Q: 为什么显示"演示模式"？
A: 这表示系统没有找到有效的API密钥，会提供模拟的AI响应

### Q: 如何测试API密钥是否有效？
A: 启动服务器后，在应用中尝试使用AI功能，查看是否返回真实的AI分析结果

### Q: 我的密钥被泄露了怎么办？
A: 立即登录Deepseek平台，删除旧密钥并创建新密钥

## 🔒 安全提醒

- ⚠️ **永远不要**将API密钥提交到代码仓库
- ⚠️ **永远不要**在客户端代码中硬编码API密钥
- ✅ 使用配置文件或环境变量来存储密钥
- ✅ 将config.json添加到.gitignore文件中

## 🚀 启动服务器

配置完成后，运行：
```bash
node server.js
```

现在您的AI功能应该能正常工作了！ 