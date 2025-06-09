// AI功能验证脚本
const axios = require('axios');

console.log('🔍 正在验证AI功能...\n');

async function testAIFunction() {
    try {
        // 测试AI口味分析功能
        console.log('1️⃣ 测试AI口味分析...');
        const response = await axios.post('http://localhost:8080/api/custom/analyze-taste', {
            ingredients: [
                { name: '金酒', volume: 50, abv: 40 },
                { name: '汤力水', volume: 150, abv: 0 }
            ]
        }, {
            timeout: 15000
        });

        if (response.data.success) {
            console.log('✅ AI口味分析功能正常');
            console.log(`📝 分析结果: ${response.data.analysis.substring(0, 100)}...`);
        } else {
            console.log('❌ AI口味分析返回错误');
        }

        // 测试AI智能调酒师功能
        console.log('\n2️⃣ 测试AI智能调酒师...');
        const recipeResponse = await axios.post('http://localhost:8080/api/custom/generate-recipe', {
            tasteDescription: '清爽的柠檬味鸡尾酒',
            occasion: '夏日聚会',
            alcoholStrength: '中等'
        }, {
            timeout: 15000
        });

        if (recipeResponse.data.success) {
            console.log('✅ AI智能调酒师功能正常');
            console.log(`📝 生成配方: ${recipeResponse.data.recipe.name}`);
        } else {
            console.log('❌ AI智能调酒师返回错误');
        }

        console.log('\n🎉 所有AI功能验证完成！');

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ 服务器未启动，请先运行: node server.js');
        } else if (error.response) {
            console.log(`❌ 服务器返回错误: ${error.response.status}`);
            console.log(`📝 错误信息: ${error.response.data?.message || '未知错误'}`);
        } else {
            console.log(`❌ 请求失败: ${error.message}`);
        }
    }
}

// 等待3秒再开始测试，确保服务器完全启动
setTimeout(testAIFunction, 3000); 