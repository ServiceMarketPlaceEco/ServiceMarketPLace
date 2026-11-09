-- Customer <-> provider chat, one conversation per booking.
--
-- chat_approvals: a customer or provider asks to open chat on a booking and an
--   admin approves or rejects it. One row per booking.
-- chat_messages: the messages themselves, only accepted once the booking's
--   chat is approved.
--
-- Safe to re-run: both tables use CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `chat_approvals` (
  `approval_id` varchar(36) NOT NULL,
  `booking_id` varchar(36) NOT NULL,
  `requested_by` enum('customer','provider') NOT NULL,
  `requested_by_id` varchar(255) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` varchar(255) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`approval_id`),
  UNIQUE KEY `UQ_chat_approvals_booking` (`booking_id`),
  CONSTRAINT `FK_chat_approvals_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `message_id` varchar(36) NOT NULL,
  `booking_id` varchar(36) NOT NULL,
  `sender_id` varchar(255) NOT NULL,
  `sender_type` enum('customer','provider') NOT NULL,
  `message` text NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`message_id`),
  KEY `IDX_chat_messages_booking_created` (`booking_id`, `created_at`),
  CONSTRAINT `FK_chat_messages_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
