# Cybar AI密钥配置工具 (PowerShell版本)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔑 Cybar AI密钥配置工具" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "请按照以下步骤配置您的Deepseek AI密钥：" -ForegroundColor Green
Write-Host ""
Write-Host "1. 访问 https://platform.deepseek.com" -ForegroundColor White
Write-Host "2. 注册并登录您的账号" -ForegroundColor White
Write-Host "3. 在控制台中创建API密钥" -ForegroundColor White
Write-Host "4. 复制您的API密钥（格式：sk-xxxxxxxxxx）" -ForegroundColor White
Write-Host ""

$apiKey = Read-Host "请输入您的Deepseek API密钥"

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "❌ 错误：API密钥不能为空" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

if (-not $apiKey.StartsWith("sk-")) {
    Write-Host "❌ 错误：API密钥格式不正确，应该以 sk- 开头" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "正在创建配置文件..." -ForegroundColor Yellow

$config = @{
    "DEEPSEEK_API_KEY" = $apiKey
    "comment" = "此文件包含您的API密钥，请勿分享给他人"
    "created" = (Get-Date).ToString()
} | ConvertTo-Json -Depth 2

$config | Out-File -FilePath "config.json" -Encoding UTF8

Write-Host "✅ 配置文件已创建：config.json" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 现在您可以运行服务器了：" -ForegroundColor Cyan
Write-Host "   node server.js" -ForegroundColor White
Write-Host ""
Write-Host "🔒 安全提醒：" -ForegroundColor Yellow
Write-Host "   - 请勿将config.json文件分享给他人" -ForegroundColor White
Write-Host "   - 请勿将API密钥提交到代码仓库" -ForegroundColor White
Write-Host ""

Read-Host "按回车键退出" 