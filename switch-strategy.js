#!/usr/bin/env node

/**
 * 推荐策略切换工具
 * 用法: node switch-strategy.js [STRATEGY_NAME]
 * 示例: node switch-strategy.js TIERED_RANDOM
 */

const fs = require('fs');
const path = require('path');

const AVAILABLE_STRATEGIES = ['TIERED_RANDOM', 'TIME_DECAY', 'BASIC'];
const SERVER_FILE = path.join(__dirname, 'server.js');

function getCurrentStrategy() {
    const content = fs.readFileSync(SERVER_FILE, 'utf8');
    const match = content.match(/process\.env\.RECOMMENDATION_STRATEGY\s*=\s*process\.env\.RECOMMENDATION_STRATEGY\s*\|\|\s*['"](\w+)['"]/);
    return match ? match[1] : 'UNKNOWN';
}

function setStrategy(strategy) {
    if (!AVAILABLE_STRATEGIES.includes(strategy)) {
        console.error(`❌ 无效的策略: ${strategy}`);
        console.log(`可用策略: ${AVAILABLE_STRATEGIES.join(', ')}`);
        process.exit(1);
    }
    
    let content = fs.readFileSync(SERVER_FILE, 'utf8');
    
    // 替换策略配置
    content = content.replace(
        /process\.env\.RECOMMENDATION_STRATEGY\s*=\s*process\.env\.RECOMMENDATION_STRATEGY\s*\|\|\s*['"]\w+['"]/,
        `process.env.RECOMMENDATION_STRATEGY = process.env.RECOMMENDATION_STRATEGY || '${strategy}'`
    );
    
    fs.writeFileSync(SERVER_FILE, content, 'utf8');
    console.log(`✅ 推荐策略已切换为: ${strategy}`);
    console.log(`⚠️  请重启服务器以使更改生效`);
}

function showInfo() {
    const current = getCurrentStrategy();
    console.log('\n📊 推荐策略系统');
    console.log('=====================================');
    console.log(`当前策略: ${current}`);
    console.log(`\n可用策略:`);
    AVAILABLE_STRATEGIES.forEach(s => {
        const marker = s === current ? '✓' : ' ';
        console.log(`  [${marker}] ${s}`);
    });
    console.log('\n策略说明:');
    console.log('  TIERED_RANDOM - 分层随机抽样（推荐）');
    console.log('  TIME_DECAY    - 时间衰减 + 新鲜度');
    console.log('  BASIC         - 基础策略（无多样性优化）');
    console.log('\n用法:');
    console.log('  node switch-strategy.js [STRATEGY_NAME]');
    console.log('  node switch-strategy.js TIERED_RANDOM');
    console.log('=====================================\n');
}

// 主程序
const args = process.argv.slice(2);

if (args.length === 0) {
    showInfo();
} else {
    const strategy = args[0].toUpperCase();
    setStrategy(strategy);
}
