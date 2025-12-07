const app = require('./app');

const port = process.env.PORT || 8080;

app.listen(port, () => {
    console.log(`========================================`);
    console.log(`🚀 Cybar 服务器启动成功`);
    console.log(`📍 访问地址: http://localhost:${port}`);
    console.log(`========================================`);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (apiKey && apiKey !== 'sk-your-api-key-here') {
        console.log(`🤖 AI功能: ✅ 已配置 (${apiKey.substring(0, 10)}...)`);
    } else {
        console.log(`🤖 AI功能: ❌ 未配置 (演示模式)`);
        console.log(`   请配置 DEEPSEEK_API_KEY 环境变量启用AI功能`);
    }
    console.log(`========================================`);
});