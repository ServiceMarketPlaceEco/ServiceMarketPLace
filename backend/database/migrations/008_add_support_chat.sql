-- Chat between the admin team and one customer or one provider. The client
-- asked for provider <-> admin and admin <-> customer chat as well as the
-- customer <-> provider booking chat (migration 005), which is not changed.
--
--   support_threads   one row per customer or provider who has a
--                     conversation with the admin team
--   support_messages  the messages in each conversation
--
-- The index and constraint names match what TypeORM generates for the
-- entities in src/modules/support/entities, so synchronize makes no further
-- changes. Safe to re-run.

CREATE TABLE IF NOT EXISTS `support_threads` (
  `thread_id` varchar(36) NOT NULL,
  `user_type` enum('customer','provider') NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `user_read_at` datetime(3) NULL,
  `admin_read_at` datetime(3) NULL,
  `last_message_at` datetime(3) NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`thread_id`),
  UNIQUE KEY `IDX_8d59a4be3e5db1df3a6eb51eee` (`user_type`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `support_messages` (
  `message_id` varchar(36) NOT NULL,
  `thread_id` varchar(36) NOT NULL,
  `sender_type` enum('customer','provider','admin') NOT NULL,
  `sender_id` varchar(255) NOT NULL,
  `sender_name` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `IDX_48c0863c11d08237632bdd6937` (`thread_id`, `created_at`),
  CONSTRAINT `FK_0275cf8d73cc01f87da8ffcf77f` FOREIGN KEY (`thread_id`) REFERENCES `support_threads` (`thread_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
