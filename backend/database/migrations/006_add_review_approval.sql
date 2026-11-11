-- Admin approval of reviews, asked for by the client.
--
--   reviews.status        pending / approved / rejected. New reviews start as
--                         pending and only show once an admin approves them.
--                         Reviews that already exist count as approved.
--   reviews.moderated_at  when an admin approved or rejected it
--
-- Safe to re-run.

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'status'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `reviews` ADD COLUMN `status` enum(''pending'',''approved'',''rejected'') NOT NULL DEFAULT ''approved'' AFTER `comment`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'moderated_at'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `reviews` ADD COLUMN `moderated_at` datetime NULL AFTER `status`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
