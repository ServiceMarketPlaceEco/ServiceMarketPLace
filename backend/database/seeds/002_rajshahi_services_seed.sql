-- =====================================================
-- Rajshahi ServiceHub seed data
-- Mirrors the services previously hardcoded in
-- servicehub/src/data/services.js, so switching the
-- frontend from mock data to the real API shows the
-- same catalog.
--
-- Service categories only. Safe for production.
-- The demo provider and its prices are in
-- 005_demo_accounts_seed.sql (local development only).
-- =====================================================

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
