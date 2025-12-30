@echo off
chcp 65001 >nul
echo ========================================
echo 🔑 Cybar AI密钥配置工具
echo ========================================
echo.

echo 请按照以下步骤配置您的Deepseek AI密钥：
echo.
echo 1. 访问 https://platform.deepseek.com
echo 2. 注册并登录您的账号
echo 3. 在控制台中创建API密钥
echo 4. 复制您的API密钥（格式：sk-xxxxxxxxxx）
echo.

set /p api_key="请输入您的Deepseek API密钥: "

if "%api_key%"=="" (
    echo ❌ 错误：API密钥不能为空
    pause
    exit /b 1
)

if not "%api_key:~0,3%"=="sk-" (
    echo ❌ 错误：API密钥格式不正确，应该以 sk- 开头
    pause
    exit /b 1
)

echo.
echo 正在创建配置文件...

echo {> config.json
echo   "DEEPSEEK_API_KEY": "%api_key%",>> config.json
echo   "comment": "此文件包含您的API密钥，请勿分享给他人",>> config.json
echo   "created": "%date% %time%">> config.json
echo }>> config.json

echo ✅ 配置文件已创建：config.json
echo.
echo 🚀 现在您可以运行服务器了：
echo    node server.js
echo.
echo 🔒 安全提醒：
echo    - 请勿将config.json文件分享给他人
echo    - 请勿将API密钥提交到代码仓库
echo.
pause 