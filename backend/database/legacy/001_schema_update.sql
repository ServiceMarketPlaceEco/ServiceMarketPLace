-- =====================================================
-- ServiceHub Database Migration Script
-- Run this script in DBeaver against your MySQL database
-- to add the missing fields and tables for the NestJS backend
-- =====================================================

-- =====================================================
-- 1. ALTER EXISTING TABLES - Add missing columns
-- =====================================================

-- Add missing columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255),
ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add missing columns to service_providers table
ALTER TABLE service_providers
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255),
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_reviews INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive', 'suspended', 'pending') DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add missing columns to admins table
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL,
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL,
ADD COLUMN IF NOT EXISTS role ENUM('super_admin', 'admin', 'moderator') DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add missing columns to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS icon VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add missing columns to provider_services table
ALTER TABLE provider_services
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS duration_minutes INT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add missing columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS provider_id VARCHAR(36),
ADD COLUMN IF NOT EXISTS service_id VARCHAR(36),
ADD COLUMN IF NOT EXISTS status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected') DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add missing columns to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS booking_id VARCHAR(36),
ADD COLUMN IF NOT EXISTS status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- =====================================================
-- 2. CREATE NEW TABLES
-- =====================================================

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  review_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  booking_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  provider_id VARCHAR(36) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES service_providers(provider_id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_booking_review (booking_id)
);

-- Create block_reports table
CREATE TABLE IF NOT EXISTS block_reports (
  report_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  reporter_type ENUM('customer', 'provider') NOT NULL,
  reporter_id VARCHAR(36) NOT NULL,
  reported_type ENUM('customer', 'provider') NOT NULL,
  reported_id VARCHAR(36) NOT NULL,
  report_type ENUM('block', 'report') NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
  admin_notes TEXT,
  resolved_by VARCHAR(36),
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (resolved_by) REFERENCES admins(id) ON DELETE SET NULL,
  
  INDEX idx_reporter (reporter_type, reporter_id),
  INDEX idx_reported (reported_type, reported_id),
  INDEX idx_status (status)
);

-- Create refresh_tokens table for JWT authentication
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  user_type ENUM('customer', 'provider', 'admin') NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user (user_id, user_type),
  INDEX idx_token (token(255)),
  INDEX idx_expires (expires_at)
);

-- =====================================================
-- 3. ADD FOREIGN KEY CONSTRAINTS FOR NEW COLUMNS
-- =====================================================

-- Add foreign key for bookings.provider_id if not exists
ALTER TABLE bookings
ADD CONSTRAINT fk_bookings_provider
FOREIGN KEY (provider_id) REFERENCES service_providers(provider_id) ON DELETE SET NULL;

-- Add foreign key for bookings.service_id if not exists
ALTER TABLE bookings
ADD CONSTRAINT fk_bookings_service
FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL;

-- Add foreign key for payments.booking_id if not exists
ALTER TABLE payments
ADD CONSTRAINT fk_payments_booking
FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE;

-- =====================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Indexes for service_providers
CREATE INDEX IF NOT EXISTS idx_providers_email ON service_providers(email);
CREATE INDEX IF NOT EXISTS idx_providers_status ON service_providers(status);
CREATE INDEX IF NOT EXISTS idx_providers_verified ON service_providers(is_verified);

-- Indexes for admins
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- Indexes for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);

-- =====================================================
-- 5. ADD UNIQUE CONSTRAINTS
-- =====================================================

-- Ensure unique email for customers
ALTER TABLE customers ADD UNIQUE INDEX IF NOT EXISTS unique_customer_email (email);

-- Ensure unique email for service_providers
ALTER TABLE service_providers ADD UNIQUE INDEX IF NOT EXISTS unique_provider_email (email);

-- Ensure unique email for admins
ALTER TABLE admins ADD UNIQUE INDEX IF NOT EXISTS unique_admin_email (email);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
