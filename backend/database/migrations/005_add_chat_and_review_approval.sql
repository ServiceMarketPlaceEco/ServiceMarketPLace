-- Chat between customers, providers and admins, and admin approval of
-- reviews. Both were asked for by the client.
--
--   chat_conversations  one row per chat: a booking chat (customer and
--                       provider, opens once an admin assigns the provider)
--                       or a support chat between the admins and one
--                       customer or one provider
--   chat_messages       the messages in each chat
--   reviews.status      pending / approved / rejected. New reviews start as
--                       pending and only show once an admin approves them.
--                       Reviews that already exist count as approved.
--   reviews.moderated_at  when an admin approved or rejected it
--
-- The table and index names match what TypeORM generates for the entities in
-- src/modules/chat/entities, so synchronize makes no further changes.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS `chat_conversations` (
  `conversation_id` varchar(36) NOT NULL,
  `type` enum('booking','customer_support','provider_support') NOT NULL,
  `chat_key` varchar(80) NOT NULL,
  `customer_id` varchar(36) NULL,
  `provider_id` varchar(36) NULL,
  `booking_id` varchar(36) NULL,
  `customer_read_at` datetime(3) NULL,
  `provider_read_at` datetime(3) NULL,
  `admin_read_at` datetime(3) NULL,
  `last_message_at` datetime(3) NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`conversation_id`),
  UNIQUE KEY `IDX_7a3c0f4091200271c907ef5d57` (`chat_key`),
  CONSTRAINT `FK_f78efda285469da358dc6189bbb` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_5654c978799d91baf2f1cc45c5e` FOREIGN KEY (`provider_id`) REFERENCES `service_providers` (`provider_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_74e59c3afd8a7e56d170e5a59fa` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `message_id` varchar(36) NOT NULL,
  `conversation_id` varchar(36) NOT NULL,
  `sender_type` enum('customer','provider','admin') NOT NULL,
  `sender_id` varchar(36) NOT NULL,
  `sender_name` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `IDX_bdfd8165e694fe9d3ce4140c87` (`conversation_id`, `created_at`),
  CONSTRAINT `FK_3d623662d4ee1219b23cf61e649` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations` (`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
