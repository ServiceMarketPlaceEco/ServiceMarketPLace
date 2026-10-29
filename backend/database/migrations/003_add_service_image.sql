-- Adds an `image_url` to services so the catalog can show a photo for each
-- service instead of only an icon key. NULL means "no photo"; the frontend
-- then falls back to its own catalogue image or a placeholder. The seeded
-- services get their photos in database/seeds/004_service_images_seed.sql.
--
-- Safe to re-run: the column is added through an existence check + dynamic
-- SQL (MySQL has no ADD COLUMN IF NOT EXISTS).

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND COLUMN_NAME = 'image_url'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `services` ADD COLUMN `image_url` varchar(500) NULL AFTER `icon`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
