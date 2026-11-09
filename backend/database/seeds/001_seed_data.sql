-- =====================================================
-- ServiceHub Seed Data Script
-- Run this after database/migrations/000_initial_schema.sql.
-- General service categories. No accounts: the default admin
-- is in 005_demo_accounts_seed.sql (local development only).
-- Safe for production. Safe to re-run: existing rows are skipped.
-- =====================================================

-- Insert default service categories (idempotent: skips rows that already exist by name)
INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Plumbing', 'All plumbing services including repairs and installations', 'wrench', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Plumbing');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Electrical', 'Electrical repairs, installations, and maintenance', 'zap', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Electrical');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Cleaning', 'Home and office cleaning services', 'sparkles', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Cleaning');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Gardening', 'Lawn care, landscaping, and garden maintenance', 'flower', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Gardening');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Painting', 'Interior and exterior painting services', 'paintbrush', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Painting');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Moving', 'Moving and relocation services', 'truck', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Moving');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'HVAC', 'Heating, ventilation, and air conditioning services', 'thermometer', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'HVAC');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Carpentry', 'Woodwork, furniture repair, and custom builds', 'hammer', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Carpentry');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Pest Control', 'Pest removal and prevention services', 'bug', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Pest Control');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Appliance Repair', 'Repair services for home appliances', 'settings', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Appliance Repair');

-- =====================================================
-- NOTE: For testing, you can create test users via the API
-- POST /api/v1/auth/customer/register
-- POST /api/v1/auth/provider/register
-- =====================================================
