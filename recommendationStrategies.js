/**
 * 推荐策略系统
 * 支持多种推荐多样性策略，可通过配置切换
 */

// ==================== 策略配置 ====================

const STRATEGY_CONFIG = {
    // 当前使用的策略: 'TIERED_RANDOM' | 'TIME_DECAY' | 'BASIC'
    ACTIVE_STRATEGY: process.env.RECOMMENDATION_STRATEGY || 'TIERED_RANDOM',
    
    // 方案2: 分层随机抽样配置
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
    },
    
    // 方案4: 时间衰减配置
    TIME_DECAY: {
        enabled: true,
        qualityWeight: 0.7,           // 推荐质量权重 70%
        freshnessWeight: 0.3,         // 新鲜度权重 30%
        timeDecayHours: 24,           // 24小时恢复50%
        countPenaltyFactor: 0.2,      // 展示次数惩罚因子
        maxHistoryDays: 30,           // 保留历史记录天数
        cleanupThreshold: 1000        // 历史记录清理阈值
    },
    
    // 基础策略（无多样性优化）
    BASIC: {
        enabled: true
    }
};

// ==================== 策略接口 ====================

/**
 * 推荐策略基类
 */
class RecommendationStrategy {
    constructor(config) {
        this.config = config;
    }
    
    /**
     * 应用策略到推荐列表
     * @param {Array} sortedRecipes - 已排序的推荐配方列表
     * @param {Object} context - 上下文信息 { userId, session, limit, offset }
     * @returns {Promise<Array>} - 处理后的推荐列表
     */
    async apply(sortedRecipes, context) {
        throw new Error('Strategy.apply() must be implemented');
    }
    
    /**
     * 策略名称
     */
    getName() {
        return 'BaseStrategy';
    }
}

// ==================== 方案2: 分层随机抽样策略 ====================

class TieredRandomStrategy extends RecommendationStrategy {
    constructor(config) {
        super(config);
        this.tiers = config.tiers;
        this.sessionDedup = config.sessionDedup;
        this.maxSessionHistory = config.maxSessionHistory;
    }
    
    getName() {
        return 'TieredRandomStrategy';
    }
    
    async apply(sortedRecipes, context) {
        const { userId, session, limit, offset } = context;
        
        // 初始化会话历史（使用数组，因为express-session不支持Set序列化）
        if (this.sessionDedup) {
            if (!session.shownRecipes) {
                session.shownRecipes = [];
            }
            
            // 确保是数组类型
            if (!Array.isArray(session.shownRecipes)) {
                console.log(`[TieredRandom] 会话数据类型错误，重新初始化`);
                session.shownRecipes = [];
            }
            
            // 清理历史记录（防止无限增长）
            if (session.shownRecipes.length > this.maxSessionHistory) {
                console.log(`[TieredRandom] 清理会话历史: ${session.shownRecipes.length} -> 0`);
                session.shownRecipes = [];
            }
        }
        
        // 过滤已展示的配方
        let availableRecipes = sortedRecipes;
        if (this.sessionDedup && session.shownRecipes && session.shownRecipes.length > 0) {
            const shownSet = new Set(session.shownRecipes);
            availableRecipes = sortedRecipes.filter(r => !shownSet.has(r.id));
            console.log(`[TieredRandom] 过滤后可用配方: ${availableRecipes.length}/${sortedRecipes.length}`);
        }
        
        // 如果可用配方不足，重置历史
        if (availableRecipes.length < limit && this.sessionDedup) {
            console.log(`[TieredRandom] 可用配方不足，重置会话历史`);
            session.shownRecipes = [];
            availableRecipes = sortedRecipes;
        }
        
        // 按得分分层
        const tieredRecipes = this._groupByTiers(availableRecipes);
        
        // 按比例从每层抽样
        const sampledRecipes = this._sampleFromTiers(tieredRecipes, limit);
        
        // 记录已展示的配方（添加到数组）
        if (this.sessionDedup && session.shownRecipes) {
            sampledRecipes.forEach(r => {
                if (!session.shownRecipes.includes(r.id)) {
                    session.shownRecipes.push(r.id);
                }
            });
        }
        
        console.log(`[TieredRandom] 分层抽样完成: ${sampledRecipes.length}条推荐`);
        
        return sampledRecipes;
    }
    
    /**
     * 按得分分层
     */
    _groupByTiers(recipes) {
        const tieredRecipes = {};
        
        this.tiers.forEach(tier => {
            tieredRecipes[tier.name] = recipes.filter(r => 
                r.totalScore >= tier.minScore && r.totalScore < tier.maxScore
            );
        });
        
        // 打印分层统计
        console.log('[TieredRandom] 分层统计:');
        this.tiers.forEach(tier => {
            console.log(`  - ${tier.name}: ${tieredRecipes[tier.name].length}条`);
        });
        
        return tieredRecipes;
    }
    
    /**
     * 从各层按比例随机抽样
     */
    _sampleFromTiers(tieredRecipes, totalLimit) {
        const samples = [];
        
        this.tiers.forEach(tier => {
            const targetCount = Math.floor(totalLimit * tier.percentage);
            const available = tieredRecipes[tier.name];
            const sampled = this._randomSample(available, targetCount);
            samples.push(...sampled);
        });
        
        // 如果抽样不足，从剩余配方中补充
        if (samples.length < totalLimit) {
            const allRemaining = Object.values(tieredRecipes)
                .flat()
                .filter(r => !samples.find(s => s.id === r.id));
            const needed = totalLimit - samples.length;
            const additional = this._randomSample(allRemaining, needed);
            samples.push(...additional);
        }
        
        // 最后打乱顺序
        return this._shuffle(samples);
    }
    
    /**
     * 随机抽样
     */
    _randomSample(array, count) {
        if (!array || array.length === 0) return [];
        const shuffled = this._shuffle([...array]);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }
    
    /**
     * 数组随机打乱
     */
    _shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

// ==================== 方案4: 时间衰减策略 ====================

class TimeDecayStrategy extends RecommendationStrategy {
    constructor(config, dbPool) {
        super(config);
        this.dbPool = dbPool;
        this.qualityWeight = config.qualityWeight;
        this.freshnessWeight = config.freshnessWeight;
        this.timeDecayHours = config.timeDecayHours;
        this.countPenaltyFactor = config.countPenaltyFactor;
        this.maxHistoryDays = config.maxHistoryDays;
    }
    
    getName() {
        return 'TimeDecayStrategy';
    }
    
    async apply(sortedRecipes, context) {
        const { userId, limit, offset } = context;
        
        // 获取用户的展示历史
        const history = await this._getUserHistory(userId);
        
        // 计算每个配方的新鲜度得分
        const recipesWithFreshness = sortedRecipes.map(recipe => {
            const freshnessScore = this._calculateFreshnessScore(recipe, history);
            const finalScore = recipe.totalScore * (this.qualityWeight + this.freshnessWeight * freshnessScore);
            
            return {
                ...recipe,
                freshnessScore,
                originalScore: recipe.totalScore,
                finalScore
            };
        });
        
        // 按最终得分重新排序
        const reranked = recipesWithFreshness.sort((a, b) => b.finalScore - a.finalScore);
        
        // 分页截取
        const selected = reranked.slice(offset, offset + limit);
        
        // 记录展示历史
        await this._recordHistory(userId, selected);
        
        console.log(`[TimeDecay] 时间衰减重排完成: ${selected.length}条推荐`);
        
        return selected;
    }
    
    /**
     * 获取用户展示历史
     */
    async _getUserHistory(userId) {
        try {
            const [rows] = await this.dbPool.query(`
                SELECT recipe_id, shown_at, show_count
                FROM user_recommendation_history
                WHERE user_id = ?
                AND shown_at > DATE_SUB(NOW(), INTERVAL ? DAY)
            `, [userId, this.maxHistoryDays]);
            
            const historyMap = new Map();
            rows.forEach(row => {
                historyMap.set(row.recipe_id, {
                    lastShown: new Date(row.shown_at),
                    showCount: row.show_count
                });
            });
            
            return historyMap;
        } catch (error) {
            console.error('[TimeDecay] 获取历史失败:', error.message);
            return new Map();
        }
    }
    
    /**
     * 计算新鲜度得分
     */
    _calculateFreshnessScore(recipe, history) {
        const historyEntry = history.get(recipe.id);
        
        if (!historyEntry) {
            return 1.0;  // 从未展示，满分
        }
        
        const now = Date.now();
        const lastShown = historyEntry.lastShown.getTime();
        const hoursSinceLastShown = (now - lastShown) / (1000 * 60 * 60);
        const showCount = historyEntry.showCount;
        
        // 时间衰减：每N小时恢复50%
        const timeDecay = Math.min(1.0, hoursSinceLastShown / this.timeDecayHours);
        
        // 展示次数惩罚：展示越多，得分越低
        const countPenalty = 1 / (1 + showCount * this.countPenaltyFactor);
        
        const freshnessScore = timeDecay * countPenalty;
        
        return freshnessScore;
    }
    
    /**
     * 记录展示历史
     */
    async _recordHistory(userId, recipes) {
        if (!recipes || recipes.length === 0) return;
        
        try {
            // 批量插入或更新
            const values = recipes.map(r => [userId, r.id]);
            
            await this.dbPool.query(`
                INSERT INTO user_recommendation_history (user_id, recipe_id, shown_at, show_count)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                    shown_at = NOW(),
                    show_count = show_count + 1
            `, [values]);
            
            console.log(`[TimeDecay] 记录展示历史: ${recipes.length}条`);
        } catch (error) {
            console.error('[TimeDecay] 记录历史失败:', error.message);
        }
    }
}

// ==================== 基础策略（无多样性优化）====================

class BasicStrategy extends RecommendationStrategy {
    getName() {
        return 'BasicStrategy';
    }
    
    async apply(sortedRecipes, context) {
        const { limit, offset } = context;
        return sortedRecipes.slice(offset, offset + limit);
    }
}

// ==================== 策略工厂 ====================

class StrategyFactory {
    constructor(dbPool) {
        this.dbPool = dbPool;
        this.strategies = new Map();
        this._registerStrategies();
    }
    
    /**
     * 注册所有策略
     */
    _registerStrategies() {
        // 注册方案2: 分层随机
        this.strategies.set('TIERED_RANDOM', 
            new TieredRandomStrategy(STRATEGY_CONFIG.TIERED_RANDOM)
        );
        
        // 注册方案4: 时间衰减
        this.strategies.set('TIME_DECAY', 
            new TimeDecayStrategy(STRATEGY_CONFIG.TIME_DECAY, this.dbPool)
        );
        
        // 注册基础策略
        this.strategies.set('BASIC', 
            new BasicStrategy(STRATEGY_CONFIG.BASIC)
        );
        
        console.log(`[StrategyFactory] 已注册 ${this.strategies.size} 个推荐策略`);
    }
    
    /**
     * 获取当前激活的策略
     */
    getActiveStrategy() {
        const strategyName = STRATEGY_CONFIG.ACTIVE_STRATEGY;
        const strategy = this.strategies.get(strategyName);
        
        if (!strategy) {
            console.warn(`[StrategyFactory] 策略 ${strategyName} 不存在，使用基础策略`);
            return this.strategies.get('BASIC');
        }
        
        console.log(`[StrategyFactory] 使用策略: ${strategy.getName()}`);
        return strategy;
    }
    
    /**
     * 获取指定策略
     */
    getStrategy(strategyName) {
        return this.strategies.get(strategyName);
    }
    
    /**
     * 注册新策略（用于扩展）
     */
    registerStrategy(name, strategy) {
        this.strategies.set(name, strategy);
        console.log(`[StrategyFactory] 注册新策略: ${name}`);
    }
    
    /**
     * 列出所有可用策略
     */
    listStrategies() {
        return Array.from(this.strategies.keys());
    }
}

// ==================== 导出 ====================

module.exports = {
    STRATEGY_CONFIG,
    RecommendationStrategy,
    TieredRandomStrategy,
    TimeDecayStrategy,
    BasicStrategy,
    StrategyFactory
};
