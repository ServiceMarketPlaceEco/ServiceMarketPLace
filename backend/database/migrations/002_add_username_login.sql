-- Adds a `username` sign-in identifier to customers and service_providers
-- (the sign-in page has always promised "username, phone number or email",
-- but the column never existed), plus a phone_verifications table backing
-- the customer signup SMS-code step.
--
-- Safe to re-run: columns/indexes are added through an existence check +
-- dynamic SQL (MySQL has no ADD COLUMN/INDEX IF NOT EXISTS), and the new
-- table uses CREATE TABLE IF NOT EXISTS.

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'username'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `username` varchar(50) NULL AFTER `name`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'uq_customers_username'
);
SET @ddl = IF(@idx_exists = 0,
  'ALTER TABLE `customers` ADD UNIQUE INDEX `uq_customers_username` (`username`)',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_providers' AND COLUMN_NAME = 'username'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `service_providers` ADD COLUMN `username` varchar(50) NULL AFTER `provider_name`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_providers' AND INDEX_NAME = 'uq_service_providers_username'
);
SET @ddl = IF(@idx_exists = 0,
  'ALTER TABLE `service_providers` ADD UNIQUE INDEX `uq_service_providers_username` (`username`)',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backs POST /auth/phone-verification/request and /verify: a short-lived
-- code tied to a phone number, consumed once by register/customer.
CREATE TABLE IF NOT EXISTS `phone_verifications` (
  `id` varchar(36) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `verification_token` varchar(255) NULL,
  `is_verified` tinyint NOT NULL DEFAULT '0',
  `is_consumed` tinyint NOT NULL DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
