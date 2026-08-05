-- =====================================================
-- Rajshahi ServiceHub seed data
-- Mirrors the services previously hardcoded in
-- servicehub/src/data/services.js, so switching the
-- frontend from mock data to the real API shows the
-- same catalog.
--
-- Demo provider login (for testing pricing/bookings):
--   email:    demo.provider@servicehub.local
--   password: Provider@123
-- =====================================================

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

-- Service categories (idempotent: skips rows that already exist by name)
INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Home Cleaning', 'General cleaning, kitchen cleaning and household support in Rajshahi.', 'home', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Home Cleaning');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Moving Help', 'Packing, lifting, small shifting and local moving support.', 'truck', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Moving Help');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Local Delivery', 'Parcel, medicine, document and food delivery around Rajshahi.', 'package', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Local Delivery');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Tech Support', 'Laptop, WiFi, mobile setup and basic software support.', 'laptop', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Tech Support');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'AC Repair', 'AC servicing, cooling issue checks and installation help.', 'thermometer', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'AC Repair');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Electrician', 'Fan, switch, light, socket and wiring support.', 'zap', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Electrician');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Plumbing Help', 'Tap leaks, pipe issues, bathroom fittings and drainage help.', 'wrench', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Plumbing Help');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Home Tutoring', 'Local academic support for school and college students.', 'book', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Home Tutoring');

INSERT INTO services (service_id, service_name, description, icon, is_active)
SELECT UUID(), 'Elder Care Visit', 'Basic home visit support, errands and check-in assistance.', 'heart', TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE service_name = 'Elder Care Visit');

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
