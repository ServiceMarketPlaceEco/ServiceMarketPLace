-- Any signed-in customer can review an approved provider, even without a
-- booking through ServiceHub, so a review's booking_id can be empty. Every
-- review still waits for an admin to approve it (migration 006).
--
-- Safe to re-run.

SET @nullable = (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'booking_id'
);
SET @ddl = IF(@nullable = 'NO',
  'ALTER TABLE `reviews` MODIFY `booking_id` varchar(255) NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
