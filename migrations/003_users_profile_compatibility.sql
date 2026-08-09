-- Upgrade legacy users tables to the profile schema used by the application.
-- This migration is idempotent and can be run repeatedly with the MySQL CLI.
DROP PROCEDURE IF EXISTS ensure_users_column;
DELIMITER //
CREATE PROCEDURE ensure_users_column(IN p_column_name varchar(64), IN p_column_definition text)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = p_column_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE users ADD COLUMN `', p_column_name, '` ', p_column_definition);
    PREPARE statement FROM @ddl;
    EXECUTE statement;
    DEALLOCATE PREPARE statement;
  END IF;
END //
DELIMITER ;

CALL ensure_users_column('avatar', 'varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT ''用户头像路径''');
CALL ensure_users_column('signature', 'varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT ''这里还没有签名哦'' COMMENT ''用户签名''');
DROP PROCEDURE IF EXISTS ensure_users_column;
