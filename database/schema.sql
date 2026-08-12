-- Clean production-safe schema. This file intentionally contains no accounts,
-- passwords, API keys, comments, or other user-generated data.
CREATE DATABASE IF NOT EXISTS cybar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cybar;

CREATE TABLE IF NOT EXISTS users (
  id varchar(32) NOT NULL,
  username varchar(32) NOT NULL,
  password varchar(255) NOT NULL,
  role enum('user','admin') NOT NULL DEFAULT 'user',
  avatar varchar(255) DEFAULT NULL,
  signature varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cocktails (
  id varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  instructions text,
  estimated_abv decimal(5,2) NOT NULL DEFAULT 0,
  total_volume decimal(10,2) NOT NULL DEFAULT 0,
  created_by varchar(32) NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  image varchar(255) DEFAULT NULL,
  description text,
  PRIMARY KEY (id),
  KEY idx_cocktails_created_at (created_at),
  KEY idx_cocktails_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredients (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  cocktail_id varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  volume decimal(10,2) NOT NULL DEFAULT 0,
  abv decimal(5,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_ingredients_cocktail (cocktail_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comment (
  thread_id varchar(32) NOT NULL,
  id varchar(32) NOT NULL,
  user_id varchar(32) NOT NULL,
  username varchar(32) NOT NULL,
  text varchar(1000) NOT NULL,
  timestamp datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_comment_thread_timestamp (thread_id, timestamp),
  KEY idx_comment_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS likes (
  id varchar(32) NOT NULL,
  user_id varchar(32) NOT NULL,
  recipe_id varchar(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_likes_user_recipe (user_id, recipe_id),
  KEY idx_likes_recipe (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorites (
  id varchar(32) NOT NULL,
  user_id varchar(32) NOT NULL,
  recipe_id varchar(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_favorites_user_recipe (user_id, recipe_id),
  KEY idx_favorites_recipe (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  cache_key char(64) NOT NULL,
  model varchar(100) NOT NULL,
  prompt_version varchar(50) NOT NULL,
  normalized_input json NOT NULL,
  response_json json NOT NULL,
  analyzed_at datetime(3) NOT NULL,
  expires_at datetime(3) NOT NULL,
  PRIMARY KEY (cache_key),
  KEY idx_ai_analysis_cache_expires_at (expires_at),
  KEY idx_ai_analysis_cache_analyzed_at (analyzed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  sid varchar(128) NOT NULL,
  expires_at datetime(3) NOT NULL,
  data longtext NOT NULL,
  PRIMARY KEY (sid),
  KEY idx_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
