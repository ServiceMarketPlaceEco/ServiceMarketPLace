-- Adds live provider-location tracking to bookings, for the customer's
-- "Track your booking" map. Columns start NULL until a provider shares
-- their position on an active job.
--
-- MySQL has no ADD COLUMN IF NOT EXISTS (that's a MariaDB extension), so
-- each column is added through a small existence check + dynamic SQL,
-- making the whole file safe to run more than once.

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'provider_lat'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `bookings` ADD COLUMN `provider_lat` DECIMAL(10, 7) NULL AFTER `total_amount`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'provider_lng'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `bookings` ADD COLUMN `provider_lng` DECIMAL(10, 7) NULL AFTER `provider_lat`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'location_updated_at'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `bookings` ADD COLUMN `location_updated_at` DATETIME NULL AFTER `provider_lng`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
