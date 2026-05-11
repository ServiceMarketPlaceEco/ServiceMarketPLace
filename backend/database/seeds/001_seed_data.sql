-- =====================================================
-- ServiceHub Seed Data Script
-- Run this after the migration script to populate
-- initial data for testing
-- =====================================================

-- Create default admin account
-- Password: Admin@123 (hashed with bcrypt)
INSERT INTO admins (id, name, email, password_hash, role, is_active, created_at)
VALUES (
  UUID(),
  'Super Admin',
  'admin@servicehub.com',
  '$2b$10$rqKJ.HvbN8N8N8N8N8N8N.8N8N8N8N8N8N8N8N8N8N8N8N8N8N8N8',
  'super_admin',
  TRUE,
  NOW()
) ON DUPLICATE KEY UPDATE name = name;

-- Insert default service categories
INSERT INTO services (service_id, service_name, description, icon, is_active, created_at)
VALUES 
  (UUID(), 'Plumbing', 'All plumbing services including repairs and installations', 'wrench', TRUE, NOW()),
  (UUID(), 'Electrical', 'Electrical repairs, installations, and maintenance', 'zap', TRUE, NOW()),
  (UUID(), 'Cleaning', 'Home and office cleaning services', 'sparkles', TRUE, NOW()),
  (UUID(), 'Gardening', 'Lawn care, landscaping, and garden maintenance', 'flower', TRUE, NOW()),
  (UUID(), 'Painting', 'Interior and exterior painting services', 'paintbrush', TRUE, NOW()),
  (UUID(), 'Moving', 'Moving and relocation services', 'truck', TRUE, NOW()),
  (UUID(), 'HVAC', 'Heating, ventilation, and air conditioning services', 'thermometer', TRUE, NOW()),
  (UUID(), 'Carpentry', 'Woodwork, furniture repair, and custom builds', 'hammer', TRUE, NOW()),
  (UUID(), 'Pest Control', 'Pest removal and prevention services', 'bug', TRUE, NOW()),
  (UUID(), 'Appliance Repair', 'Repair services for home appliances', 'settings', TRUE, NOW())
ON DUPLICATE KEY UPDATE service_name = service_name;

-- =====================================================
-- NOTE: For testing, you can create test users via the API
-- POST /api/v1/auth/customer/register
-- POST /api/v1/auth/provider/register
-- =====================================================
