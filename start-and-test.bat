@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 Cybar AI密钥配置验证
echo ========================================
echo.

echo ✅ API密钥已配置: sk-0836ffd1389c405aaa65c108e8986e20
echo.

echo 🔍 正在启动服务器...
start /B node server.js

echo ⏳ 等待服务器启动...
timeout /t 5 /nobreak >nul

echo.
echo 🧪 正在测试AI功能...
node verify-ai-function.js

echo.
echo 📍 服务器地址: http://localhost:8080
echo 🔧 如需停止服务器，请按 Ctrl+C
echo.
pause 