# 推荐策略系统使用指南

## 📋 概述

本系统实现了灵活的推荐多样性策略，支持通过配置切换不同策略，并易于扩展新策略。

---

## 🎯 可用策略

### 1. **TIERED_RANDOM** - 分层随机抽样（默认）

**特点**:
- ✅ 按得分分层，每层随机抽样
- ✅ 会话去重，避免重复展示
- ✅ 保证高质量推荐占主导
- ✅ 增加"惊喜发现"

**适用场景**: 
- 大多数场景
- 推荐池较大（>30个配方）
- 用户频繁刷新

**配置参数**:
```javascript
TIERED_RANDOM: {
    enabled: true,
    tiers: [
        { name: 'excellent', minScore: 9, maxScore: 13, percentage: 0.5 },    // 50% 优秀
        { name: 'good', minScore: 7, maxScore: 9, percentage: 0.3 },          // 30% 良好
        { name: 'medium', minScore: 5, maxScore: 7, percentage: 0.1 },        // 10% 中等
        { name: 'explore', minScore: 0, maxScore: 5, percentage: 0.1 }        // 10% 探索
    ],
    sessionDedup: true,           // 启用会话去重
    maxSessionHistory: 100        // 会话历史最大记录数
}
```

---

### 2. **TIME_DECAY** - 时间衰减 + 新鲜度

**特点**:
- ✅ 基于展示历史动态调整得分
- ✅ 时间越久，配方越"新鲜"
- ✅ 展示次数越多，得分越低
- ✅ 持久化历史记录

**适用场景**:
- 用户频繁访问推荐页面
- 需要长期优化用户体验
- 有数据库支持

**配置参数**:
```javascript
TIME_DECAY: {
    enabled: true,
    qualityWeight: 0.7,           // 推荐质量权重 70%
    freshnessWeight: 0.3,         // 新鲜度权重 30%
    timeDecayHours: 24,           // 24小时恢复50%
    countPenaltyFactor: 0.2,      // 展示次数惩罚因子
    maxHistoryDays: 30,           // 保留历史记录天数
    cleanupThreshold: 1000        // 历史记录清理阈值
}
```

**数据库要求**:
需要创建 `user_recommendation_history` 表：
```bash
mysql -u cybar_user -p cybar < migrations/create_recommendation_history.sql
```

---

### 3. **BASIC** - 基础策略

**特点**:
- 无多样性优化
- 纯粹按得分排序
- 性能最优

**适用场景**:
- 测试对比
- 性能优先

---

## 🔧 如何切换策略

### 方法1: 修改 server.js（推荐）

在 `server.js` 第49行修改：

```javascript
// 可选值: 'TIERED_RANDOM' | 'TIME_DECAY' | 'BASIC'
process.env.RECOMMENDATION_STRATEGY = 'TIERED_RANDOM';  // ← 修改这里
```

### 方法2: 环境变量

启动服务器时设置：

```bash
# Windows PowerShell
$env:RECOMMENDATION_STRATEGY="TIME_DECAY"
node server.js

# Linux/Mac
RECOMMENDATION_STRATEGY=TIME_DECAY node server.js
```

### 方法3: .env 文件

创建 `.env` 文件：

```env
RECOMMENDATION_STRATEGY=TIERED_RANDOM
```

---

## 📊 策略效果对比

| 策略 | 多样性 | 准确性 | 性能 | 数据库依赖 |
|------|--------|--------|------|------------|
| **TIERED_RANDOM** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ 无 |
| **TIME_DECAY** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ 需要 |
| **BASIC** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ 无 |

---

## 🎨 如何添加新策略

### 步骤1: 创建策略类

在 `recommendationStrategies.js` 中添加：

```javascript
class MyCustomStrategy extends RecommendationStrategy {
    constructor(config) {
        super(config);
        // 初始化自定义参数
    }
    
    getName() {
        return 'MyCustomStrategy';
    }
    
    async apply(sortedRecipes, context) {
        const { userId, session, limit, offset } = context;
        
        // 实现你的策略逻辑
        // ...
        
        return processedRecipes;
    }
}
```

### 步骤2: 添加配置

在 `STRATEGY_CONFIG` 中添加：

```javascript
const STRATEGY_CONFIG = {
    // ... 现有配置
    
    MY_CUSTOM: {
        enabled: true,
        // 你的配置参数
        param1: 'value1',
        param2: 100
    }
};
```

### 步骤3: 注册策略

在 `StrategyFactory._registerStrategies()` 中添加：

```javascript
_registerStrategies() {
    // ... 现有注册
    
    this.strategies.set('MY_CUSTOM', 
        new MyCustomStrategy(STRATEGY_CONFIG.MY_CUSTOM)
    );
}
```

### 步骤4: 导出类（可选）

```javascript
module.exports = {
    // ... 现有导出
    MyCustomStrategy
};
```

### 步骤5: 使用新策略

```javascript
process.env.RECOMMENDATION_STRATEGY = 'MY_CUSTOM';
```

---

## 🧪 测试建议

### 1. 单元测试

```javascript
// test/strategies.test.js
const { TieredRandomStrategy } = require('../recommendationStrategies');

describe('TieredRandomStrategy', () => {
    it('should return diversified recommendations', async () => {
        const strategy = new TieredRandomStrategy(config);
        const result = await strategy.apply(mockRecipes, mockContext);
        expect(result.length).toBe(10);
    });
});
```

### 2. A/B测试

对比不同策略的效果：

```javascript
// 记录用户行为
app.post('/api/track', (req, res) => {
    const { userId, recipeId, action, strategy } = req.body;
    // 记录: 用户在哪个策略下点击了哪个配方
});
```

### 3. 性能测试

```javascript
console.time('RecommendationStrategy');
const result = await strategy.apply(recipes, context);
console.timeEnd('RecommendationStrategy');
```

---

## 📈 监控指标

### 关键指标

1. **点击率 (CTR)**: 推荐配方被点击的比例
2. **点赞率**: 推荐配方被点赞的比例
3. **多样性**: 用户看到不同配方的比例
4. **响应时间**: 策略执行耗时

### 日志示例

```
[TieredRandom] 过滤后可用配方: 45/50
[TieredRandom] 分层统计:
  - excellent: 12条
  - good: 18条
  - medium: 10条
  - explore: 5条
[TieredRandom] 分层抽样完成: 10条推荐
```

---

## 🔍 故障排查

### 问题1: 策略不生效

**检查**:
```javascript
// 查看当前策略
console.log(process.env.RECOMMENDATION_STRATEGY);

// 查看可用策略
console.log(strategyFactory.listStrategies());
```

### 问题2: TIME_DECAY 报错

**原因**: 数据库表未创建

**解决**:
```bash
mysql -u cybar_user -p cybar < migrations/create_recommendation_history.sql
```

### 问题3: 推荐重复

**TIERED_RANDOM**: 检查会话是否过期
```javascript
// 手动清空会话历史
req.session.shownRecipes = new Set();
```

**TIME_DECAY**: 检查历史记录
```sql
SELECT * FROM user_recommendation_history WHERE user_id = 123;
```

---

## 🚀 性能优化建议

### 1. 缓存策略结果

```javascript
const cache = new Map();
const cacheKey = `${userId}_${strategy}_${page}`;

if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
}

const result = await strategy.apply(recipes, context);
cache.set(cacheKey, result);
```

### 2. 批量查询优化

TIME_DECAY 策略已使用批量插入：
```javascript
INSERT INTO user_recommendation_history (user_id, recipe_id, shown_at, show_count)
VALUES (?, ?), (?, ?), ...
ON DUPLICATE KEY UPDATE show_count = show_count + 1
```

### 3. 索引优化

确保数据库索引正确：
```sql
SHOW INDEX FROM user_recommendation_history;
```

---

## 📚 参考资料

### 推荐系统理论

- **协同过滤**: 基于用户相似度推荐
- **内容过滤**: 基于物品特征推荐
- **混合推荐**: 结合多种方法
- **探索-利用**: 平衡新旧内容

### 多样性优化

- **MMR (Maximal Marginal Relevance)**: 最大边际相关性
- **DPP (Determinantal Point Process)**: 行列式点过程
- **Greedy Diversification**: 贪心多样化

---

## 📞 技术支持

如有问题，请查看：
1. 日志输出: `console.log` 中的策略信息
2. 数据库日志: 检查 SQL 执行情况
3. 会话状态: `req.session.shownRecipes`

---

**最后更新**: 2025-12-04  
**版本**: 1.0.0
