-- =====================================================
-- ServiceHub - 000 Initial Schema
--
-- Creates the full ServiceHub database from scratch on an
-- EMPTY MySQL 8.0+ database. Run this first, then the seed
-- scripts in database/seeds/ (in numeric order).
--
-- This schema matches the TypeORM entities in
-- src/modules/**/entities/*.entity.ts exactly (including the
-- index/constraint names TypeORM generates), so starting the
-- backend with NODE_ENV=development (synchronize on) makes
-- no further changes to it.
--
-- If you change an entity, update this file too (or add a
-- new numbered migration) so a fresh setup stays in sync.
--
-- Safe to re-run: every table uses CREATE TABLE IF NOT EXISTS.
-- =====================================================

SET NAMES utf8mb4;

-- Admin accounts (login via POST /api/v1/auth/admin/login)
CREATE TABLE IF NOT EXISTS `admins` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('super_admin','admin','moderator') NOT NULL DEFAULT 'admin',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_051db7d37d478a69a7432df147` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Customer accounts
CREATE TABLE IF NOT EXISTS `customers` (
  `customer_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `age` int DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text,
  `profile_image` varchar(500) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `is_blocked` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `IDX_8536b8b85c06969f84f0c098b0` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Service provider accounts
CREATE TABLE IF NOT EXISTS `service_providers` (
  `provider_id` varchar(36) NOT NULL,
  `provider_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `ABN` int DEFAULT NULL,
  `address` text,
  `postal_code` int DEFAULT NULL,
  `phone` int DEFAULT NULL,
  `description` text,
  `profile_image` varchar(500) DEFAULT NULL,
  `rating` decimal(3,2) NOT NULL DEFAULT '0.00',
  `total_reviews` int NOT NULL DEFAULT '0',
  `is_verified` tinyint NOT NULL DEFAULT '0',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `is_blocked` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`provider_id`),
  UNIQUE KEY `IDX_14d1adea0db135f924c3d017a7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Service categories shown in the catalog
CREATE TABLE IF NOT EXISTS `services` (
  `service_id` varchar(36) NOT NULL,
  `service_name` varchar(255) NOT NULL,
  `description` text,
  `icon` varchar(100) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A provider's offering (price etc.) for a service category
CREATE TABLE IF NOT EXISTS `provider_services` (
  `id` varchar(36) NOT NULL,
  `provider_id` varchar(255) NOT NULL,
  `service_id` varchar(255) NOT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `description` text,
  `is_available` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_f7a9f75184826281d7e79449791` (`provider_id`),
  KEY `FK_4155bec585f9bf02e99ba19a34c` (`service_id`),
  CONSTRAINT `FK_4155bec585f9bf02e99ba19a34c` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`),
  CONSTRAINT `FK_f7a9f75184826281d7e79449791` FOREIGN KEY (`provider_id`) REFERENCES `service_providers` (`provider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Bookings made by customers against a provider_service
CREATE TABLE IF NOT EXISTS `bookings` (
  `booking_id` varchar(36) NOT NULL,
  `customer_id` varchar(255) NOT NULL,
  `provider_service_id` varchar(36) DEFAULT NULL,
  `job_id` varchar(36) DEFAULT NULL,
  `service_name` varchar(255) DEFAULT NULL,
  `payment_id` varchar(36) DEFAULT NULL,
  `date` date NOT NULL,
  `time` time NOT NULL,
  `status` enum('pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  `notes` text,
  `address` text,
  `total_amount` decimal(10,2) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`booking_id`),
  KEY `FK_8e21b7ae33e7b0673270de4146f` (`customer_id`),
  KEY `FK_ed508689390a01b51fce3a73b3d` (`provider_service_id`),
  CONSTRAINT `FK_8e21b7ae33e7b0673270de4146f` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  CONSTRAINT `FK_ed508689390a01b51fce3a73b3d` FOREIGN KEY (`provider_service_id`) REFERENCES `provider_services` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Payments (one per booking)
CREATE TABLE IF NOT EXISTS `payments` (
  `payment_id` varchar(36) NOT NULL,
  `booking_id` varchar(255) DEFAULT NULL,
  `customer_id` varchar(255) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('credit_card','debit_card','paypal','bank_transfer','cash') NOT NULL DEFAULT 'credit_card',
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `transaction_id` varchar(255) DEFAULT NULL,
  `payment_date` timestamp NULL DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `REL_e86edf76dc2424f123b9023a2b` (`booking_id`),
  KEY `FK_d0b02233df1c52323107fe7b4d7` (`customer_id`),
  CONSTRAINT `FK_d0b02233df1c52323107fe7b4d7` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  CONSTRAINT `FK_e86edf76dc2424f123b9023a2b2` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Customer reviews of providers
CREATE TABLE IF NOT EXISTS `reviews` (
  `review_id` varchar(36) NOT NULL,
  `booking_id` varchar(255) NOT NULL,
  `customer_id` varchar(255) NOT NULL,
  `provider_id` varchar(255) NOT NULL,
  `rating` int NOT NULL,
  `comment` text,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`review_id`),
  KEY `FK_bbd6ac6e3e6a8f8c6e0e8692d63` (`booking_id`),
  KEY `FK_4dd42f48aa60ad8c0d5d5c4ea5b` (`customer_id`),
  KEY `FK_ba7ceb19946b8b23bf5939c930f` (`provider_id`),
  CONSTRAINT `FK_4dd42f48aa60ad8c0d5d5c4ea5b` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  CONSTRAINT `FK_ba7ceb19946b8b23bf5939c930f` FOREIGN KEY (`provider_id`) REFERENCES `service_providers` (`provider_id`),
  CONSTRAINT `FK_bbd6ac6e3e6a8f8c6e0e8692d63` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- User block / report records, resolved by admins
CREATE TABLE IF NOT EXISTS `block_reports` (
  `report_id` varchar(36) NOT NULL,
  `reporter_id` varchar(255) NOT NULL,
  `reporter_type` enum('customer','provider','admin') NOT NULL,
  `reported_id` varchar(255) NOT NULL,
  `reported_type` enum('customer','provider') NOT NULL,
  `reason` text NOT NULL,
  `status` enum('pending','reviewed','resolved','dismissed') NOT NULL DEFAULT 'pending',
  `admin_notes` text,
  `resolved_by` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`report_id`),
  KEY `FK_a6ba926c8f4ffece24f28ac9747` (`resolved_by`),
  CONSTRAINT `FK_a6ba926c8f4ffece24f28ac9747` FOREIGN KEY (`resolved_by`) REFERENCES `admins` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- JWT refresh tokens
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `user_type` enum('customer','provider','admin') NOT NULL,
  `token` varchar(500) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
