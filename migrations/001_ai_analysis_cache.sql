-- 可重复执行。请在发布新版应用前运行。
CREATE TABLE IF NOT EXISTS `ai_analysis_cache` (
  `cache_key` char(64) NOT NULL,
  `model` varchar(100) NOT NULL,
  `prompt_version` varchar(50) NOT NULL,
  `normalized_input` json NOT NULL,
  `response_json` json NOT NULL,
  `analyzed_at` datetime(3) NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  PRIMARY KEY (`cache_key`),
  KEY `idx_ai_analysis_cache_expires_at` (`expires_at`),
  KEY `idx_ai_analysis_cache_analyzed_at` (`analyzed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
