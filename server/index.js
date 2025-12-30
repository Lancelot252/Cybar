const app = require('./app');

const port = process.env.PORT || 8080;

app.listen(port, () => {
    console.log(`========================================`);
    console.log(`🚀 Cybar 服务器启动成功`);
    console.log(`📍 访问地址: http://localhost:${port}`);
    console.log(`========================================`);

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const qwenKey = process.env.QWEN_API_KEY;
    
    if (deepseekKey && deepseekKey !== 'sk-your-api-key-here') {
        console.log(`🤖 DeepSeek AI: ✅ 已配置 (${deepseekKey.substring(0, 10)}...)`);
    }
    
    if (qwenKey && qwenKey !== 'sk-your-api-key-here') {
        console.log(`🤖 Qwen AI: ✅ 已配置 (${qwenKey.substring(0, 10)}...)`);
    }
    
    if ((!deepseekKey || deepseekKey === 'sk-your-api-key-here') && 
        (!qwenKey || qwenKey === 'sk-your-api-key-here')) {
        console.log(`🤖 AI功能: ❌ 未配置 (演示模式)`);
        console.log(`   请在 config.json 中配置 DEEPSEEK_API_KEY 或 QWEN_API_KEY`);
    }
    console.log(`========================================`);
});