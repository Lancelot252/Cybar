-- 将早期 cocktails 表升级为当前应用结构。
-- 此文件面向 MySQL CLI，可重复执行。
DROP PROCEDURE IF EXISTS ensure_cocktails_column;
DELIMITER //
CREATE PROCEDURE ensure_cocktails_column(IN p_column_name varchar(64), IN p_column_definition text)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'cocktails' AND column_name = p_column_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE cocktails ADD COLUMN `', p_column_name, '` ', p_column_definition);
    PREPARE statement FROM @ddl;
    EXECUTE statement;
    DEALLOCATE PREPARE statement;
  END IF;
END //
DELIMITER ;

CALL ensure_cocktails_column('total_volume', 'decimal(10,2) DEFAULT 0.00 COMMENT ''总容量(ml)''');
CALL ensure_cocktails_column('image', 'varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT ''配方图片路径''');
CALL ensure_cocktails_column('description', 'text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT ''鸡尾酒描述''');
DROP PROCEDURE IF EXISTS ensure_cocktails_column;
