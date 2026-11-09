-- =====================================================
-- Demo accounts - LOCAL DEVELOPMENT ONLY
--
-- `npm run db:setup -- --production` skips this file (and
-- every other seed with "demo" or "test" in its name), so
-- these known passwords never reach a live server. Create
-- the real production admin with `npm run admin:create`.
--
--   admin:    admin@servicehub.com / Admin@123
--   provider: demo.provider@servicehub.local / Provider@123
--
-- Run after 001_seed_data.sql and 002_rajshahi_services_seed.sql
-- (the demo provider's prices point at their services).
-- Safe to re-run: existing rows are skipped.
-- =====================================================

-- Create default admin account
--   email:    admin@servicehub.com
--   password: Admin@123 (hashed with bcrypt)
INSERT INTO admins (id, name, email, password_hash, role, is_active, created_at)
VALUES (
  UUID(),
  'Super Admin',
  'admin@servicehub.com',
  '$2b$10$UF.QoWk.RszrXKDuML9o1eNnyLOZTmiGYn7GhMtNc7MHbcJCDeC5O',
  'super_admin',
  TRUE,
  NOW()
) ON DUPLICATE KEY UPDATE name = name;

-- Demo provider (all seeded services are attached to this account)
INSERT INTO service_providers (provider_id, provider_name, email, password_hash, address, description, is_verified, is_active)
VALUES (
  UUID(),
  'Rajshahi Demo Provider',
  'demo.provider@servicehub.local',
  '$2b$10$/UaekD3LHujFjDWUJamWeuVRYFTuDJnSrWwZve6tYHauz0F3l3Iv.',
  'Rajshahi City',
  'Demo provider seeded so pricing can be attached to Rajshahi services.',
  TRUE,
  TRUE
) ON DUPLICATE KEY UPDATE provider_name = provider_name;

SET @demo_provider_id = (SELECT provider_id FROM service_providers WHERE email = 'demo.provider@servicehub.local' LIMIT 1);

-- Provider pricing (matches the price field from the old mock data)
INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 500, TRUE FROM services WHERE service_name = 'Home Cleaning'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);

INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 1200, TRUE FROM services WHERE service_name = 'Moving Help'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);

INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 250, TRUE FROM services WHERE service_name = 'Local Delivery'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);

INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 800, TRUE FROM services WHERE service_name = 'Tech Support'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);

INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 1000, TRUE FROM services WHERE service_name = 'AC Repair'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);

INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 600, TRUE FROM services WHERE service_name = 'Electrician'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);

INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 550, TRUE FROM services WHERE service_name = 'Plumbing Help'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);

INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 700, TRUE FROM services WHERE service_name = 'Home Tutoring'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);

INSERT INTO provider_services (id, provider_id, service_id, price, is_available)
SELECT UUID(), @demo_provider_id, service_id, 900, TRUE FROM services WHERE service_name = 'Elder Care Visit'
  AND NOT EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = @demo_provider_id AND ps.service_id = services.service_id);
