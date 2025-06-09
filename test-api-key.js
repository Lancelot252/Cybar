// AI密钥测试脚本
const axios = require('axios');
const fs = require('fs');
const path = require('path');

console.log('🧪 正在测试Deepseek API密钥...\n');

// 尝试加载API密钥
let apiKey = null;

// 1. 从环境变量获取
if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'sk-your-api-key-here') {
    apiKey = process.env.DEEPSEEK_API_KEY;
    console.log('📍 从环境变量加载API密钥');
}

// 2. 从配置文件获取
const configFile = path.join(__dirname, 'config.json');
if (!apiKey && fs.existsSync(configFile)) {
    try {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (config.DEEPSEEK_API_KEY && config.DEEPSEEK_API_KEY !== 'sk-your-api-key-here') {
            apiKey = config.DEEPSEEK_API_KEY;
            console.log('📍 从配置文件加载API密钥');
        }
    } catch (error) {
        console.log('⚠️ 配置文件读取失败:', error.message);
    }
}

if (!apiKey) {
    console.log('❌ 未找到API密钥');
    console.log('请运行 setup-api-key.bat 或手动配置 config.json');
    process.exit(1);
}

console.log(`🔑 API密钥格式: ${apiKey.substring(0, 10)}...`);

// 测试API调用
async function testApiKey() {
    try {
        console.log('🚀 正在测试API连接...');

        const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'user',
                    content: '请回复"API测试成功"'
                }
            ],
            max_tokens: 50
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        const result = response.data.choices[0].message.content;
        console.log('✅ API测试成功！');
        console.log(`📝 AI回复: ${result}`);
        console.log('\n🎉 您的API密钥配置正确，可以正常使用AI功能！');

    } catch (error) {
        console.log('❌ API测试失败');

        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.error?.message || '未知错误';

            console.log(`📊 HTTP状态码: ${status}`);
            console.log(`📝 错误信息: ${message}`);

            if (status === 401) {
                console.log('\n💡 解决方案:');
                console.log('   - 检查API密钥是否正确');
                console.log('   - 确认密钥格式为 sk-xxxxxxxxxx');
                console.log('   - 重新生成API密钥');
            } else if (status === 402) {
                console.log('\n💡 解决方案:');
                console.log('   - 账户余额不足，请充值');
                console.log('   - 检查账户状态');
            } else if (status === 429) {
                console.log('\n💡 解决方案:');
                console.log('   - API调用频率过高，请稍后再试');
            }
        } else if (error.code === 'ECONNABORTED') {
            console.log('📝 错误信息: 请求超时');
            console.log('\n💡 解决方案:');
            console.log('   - 检查网络连接');
            console.log('   - 稍后重试');
        } else {
            console.log(`📝 错误信息: ${error.message}`);
        }

        console.log('\n⚠️ 服务器将以演示模式运行，AI功能将返回模拟结果');
    }
}

testApiKey(); 