-- Adds `failed_attempts` to phone_verifications so a signup SMS code stops
-- working after 5 wrong guesses (the customer then requests a new code).
-- Without a cap a 6-digit code could simply be guessed. This was must-fix 3
-- in the client's code review.
--
-- Safe to re-run: the column is added through an existence check + dynamic
-- SQL (MySQL has no ADD COLUMN IF NOT EXISTS).

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phone_verifications' AND COLUMN_NAME = 'failed_attempts'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `phone_verifications` ADD COLUMN `failed_attempts` int NOT NULL DEFAULT 0 AFTER `is_consumed`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
