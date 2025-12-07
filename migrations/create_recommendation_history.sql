-- 创建用户推荐历史表（用于时间衰减策略）
-- 执行方式: mysql -u cybar_user -p cybar < migrations/create_recommendation_history.sql

CREATE TABLE IF NOT EXISTS user_recommendation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    recipe_id VARCHAR(50) NOT NULL,
    shown_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    show_count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 索引优化
    INDEX idx_user_recipe (user_id, recipe_id),
    INDEX idx_shown_at (shown_at),
    INDEX idx_user_shown (user_id, shown_at),
    
    -- 唯一约束
    UNIQUE KEY uk_user_recipe (user_id, recipe_id),
    
    -- 外键约束（可选）
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户推荐展示历史记录表';

-- 创建定期清理旧数据的事件（可选）
-- 每天凌晨3点清理30天前的记录
DELIMITER $$
CREATE EVENT IF NOT EXISTS cleanup_old_recommendation_history
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 3 HOUR)
DO
BEGIN
    DELETE FROM user_recommendation_history
    WHERE shown_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END$$
DELIMITER ;

-- 查看表结构
DESCRIBE user_recommendation_history;

-- 查看索引
SHOW INDEX FROM user_recommendation_history;

SELECT 'user_recommendation_history 表创建成功！' AS message;
