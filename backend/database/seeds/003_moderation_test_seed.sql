-- =====================================================
-- moderation test seed data
-- run this AFTER 001_seed_data.sql and 002_rajshahi_services_seed.sql
--
-- this adds a mix of real-looking and dodgy accounts +
-- reviews so when you click "scan reviews" or "scan accounts"
-- in the admin dashboard, the AI screening actually has
-- stuff to catch.
--
-- safe to re-run, wont duplicate rows.
-- =====================================================

-- -------------------------------------------------------
-- 1. providers - one normal, one sketchy (same phone as the first)
-- -------------------------------------------------------

-- normal provider, been around for a while
INSERT INTO service_providers (provider_id, provider_name, email, password_hash, phone, address, description, is_verified, is_active, created_at)
VALUES (
  'a0000001-0000-0000-0000-000000000001',
  'Rahim Plumbing Services',
  'rahim.plumbing@test.local',
  '$2b$10$UF.QoWk.RszrXKDuML9o1eNnyLOZTmiGYn7GhMtNc7MHbcJCDeC5O',
  1712345678,
  'Rajshahi Sadar',
  'Licensed plumber with 5 years experience.',
  TRUE, TRUE,
  DATE_SUB(NOW(), INTERVAL 90 DAY)
) ON DUPLICATE KEY UPDATE provider_name = provider_name;

-- dodgy provider - uses the same phone number as Rahim which
-- triggers the DUPLICATE_IDENTITY flag in account scanning
INSERT INTO service_providers (provider_id, provider_name, email, password_hash, phone, address, description, is_verified, is_active, created_at)
VALUES (
  'a0000001-0000-0000-0000-000000000002',
  'Best Plumber Rajshahi',
  'bestplumber.rj@test.local',
  '$2b$10$UF.QoWk.RszrXKDuML9o1eNnyLOZTmiGYn7GhMtNc7MHbcJCDeC5O',
  1712345678,
  'Rajshahi',
  'Top rated plumber.',
  FALSE, TRUE,
  DATE_SUB(NOW(), INTERVAL 5 DAY)
) ON DUPLICATE KEY UPDATE provider_name = provider_name;

-- -------------------------------------------------------
-- 2. customers - some legit, some sus
-- -------------------------------------------------------

-- legit customer, account is 4 months old, normal person
INSERT INTO customers (customer_id, name, email, password_hash, phone, address, is_active, created_at)
VALUES (
  'c0000001-0000-0000-0000-000000000001',
  'Fatima Begum',
  'fatima.begum@test.local',
  '$2b$10$UF.QoWk.RszrXKDuML9o1eNnyLOZTmiGYn7GhMtNc7MHbcJCDeC5O',
  '01811111111',
  'Boalia, Rajshahi',
  TRUE,
  DATE_SUB(NOW(), INTERVAL 120 DAY)
) ON DUPLICATE KEY UPDATE name = name;

-- another legit customer
INSERT INTO customers (customer_id, name, email, password_hash, phone, address, is_active, created_at)
VALUES (
  'c0000001-0000-0000-0000-000000000002',
  'Karim Ahmed',
  'karim.ahmed@test.local',
  '$2b$10$UF.QoWk.RszrXKDuML9o1eNnyLOZTmiGYn7GhMtNc7MHbcJCDeC5O',
  '01822222222',
  'Shah Makhdum, Rajshahi',
  TRUE,
  DATE_SUB(NOW(), INTERVAL 60 DAY)
) ON DUPLICATE KEY UPDATE name = name;

-- sus customer - brand new account, only 1 day old
-- this triggers the NEW_ACCOUNT_EXTREME flag when they leave extreme ratings
INSERT INTO customers (customer_id, name, email, password_hash, phone, address, is_active, created_at)
VALUES (
  'c0000001-0000-0000-0000-000000000003',
  'New User 123',
  'newuser123@test.local',
  '$2b$10$UF.QoWk.RszrXKDuML9o1eNnyLOZTmiGYn7GhMtNc7MHbcJCDeC5O',
  '01833333333',
  '',
  TRUE,
  DATE_SUB(NOW(), INTERVAL 1 DAY)
) ON DUPLICATE KEY UPDATE name = name;

-- sus customer - looks like a sock puppet account
-- no bookings but leaves reviews for only one provider (classic boosting)
INSERT INTO customers (customer_id, name, email, password_hash, phone, address, is_active, created_at)
VALUES (
  'c0000001-0000-0000-0000-000000000004',
  'Happy Customer',
  'happy.customer@test.local',
  '$2b$10$UF.QoWk.RszrXKDuML9o1eNnyLOZTmiGYn7GhMtNc7MHbcJCDeC5O',
  '01844444444',
  '',
  TRUE,
  DATE_SUB(NOW(), INTERVAL 2 DAY)
) ON DUPLICATE KEY UPDATE name = name;

-- sus customer - shares the same phone number as Happy Customer above
-- thats the DUPLICATE_IDENTITY signal, probably the same person
INSERT INTO customers (customer_id, name, email, password_hash, phone, address, is_active, created_at)
VALUES (
  'c0000001-0000-0000-0000-000000000005',
  'Totally Different Person',
  'different.person@test.local',
  '$2b$10$UF.QoWk.RszrXKDuML9o1eNnyLOZTmiGYn7GhMtNc7MHbcJCDeC5O',
  '01844444444',
  '',
  TRUE,
  DATE_SUB(NOW(), INTERVAL 3 DAY)
) ON DUPLICATE KEY UPDATE name = name;

-- -------------------------------------------------------
-- 3. link providers to services so bookings work
-- -------------------------------------------------------

SET @plumbing_id = (SELECT service_id FROM services WHERE service_name = 'Plumbing' LIMIT 1);
SET @cleaning_id = (SELECT service_id FROM services WHERE service_name IN ('Cleaning', 'Home Cleaning') LIMIT 1);

-- rahim offers plumbing
INSERT INTO provider_services (id, provider_id, service_id, price, is_available, created_at)
SELECT 'ps000001-0000-0000-0000-000000000001',
       'a0000001-0000-0000-0000-000000000001',
       @plumbing_id, 800.00, TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM provider_services WHERE id = 'ps000001-0000-0000-0000-000000000001');

-- dodgy provider also offers plumbing
INSERT INTO provider_services (id, provider_id, service_id, price, is_available, created_at)
SELECT 'ps000001-0000-0000-0000-000000000002',
       'a0000001-0000-0000-0000-000000000002',
       @plumbing_id, 500.00, TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM provider_services WHERE id = 'ps000001-0000-0000-0000-000000000002');

-- -------------------------------------------------------
-- 4. bookings - only the legit customers have completed ones
-- -------------------------------------------------------

-- fatima booked rahim and it went through fine
INSERT INTO bookings (booking_id, customer_id, provider_service_id, service_name, date, time, status, total_amount, created_at)
VALUES (
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'ps000001-0000-0000-0000-000000000001',
  'Plumbing',
  CURDATE(), '10:00:00', 'completed', 800.00,
  DATE_SUB(NOW(), INTERVAL 10 DAY)
) ON DUPLICATE KEY UPDATE status = status;

-- karim also booked rahim, also completed
INSERT INTO bookings (booking_id, customer_id, provider_service_id, service_name, date, time, status, total_amount, created_at)
VALUES (
  'b0000001-0000-0000-0000-000000000002',
  'c0000001-0000-0000-0000-000000000002',
  'ps000001-0000-0000-0000-000000000001',
  'Plumbing',
  CURDATE(), '14:00:00', 'completed', 800.00,
  DATE_SUB(NOW(), INTERVAL 5 DAY)
) ON DUPLICATE KEY UPDATE status = status;

-- the sus customers (3, 4, 5) have NO bookings at all
-- thats what makes their reviews suspicious

-- -------------------------------------------------------
-- 5. reviews - this is where it gets interesting
-- -------------------------------------------------------

-- fatima leaves a normal review after her real booking
-- this one should NOT get flagged, its totally fine
INSERT INTO reviews (review_id, booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES (
  'r0000001-0000-0000-0000-000000000001',
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000001',
  4,
  'Rahim came on time and fixed the kitchen tap leak properly. Fair price too. Would call again for plumbing work.',
  DATE_SUB(NOW(), INTERVAL 9 DAY)
) ON DUPLICATE KEY UPDATE rating = rating;

-- karim also leaves an honest review, bit critical but fair
-- also should NOT get flagged
INSERT INTO reviews (review_id, booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES (
  'r0000001-0000-0000-0000-000000000002',
  'b0000001-0000-0000-0000-000000000002',
  'c0000001-0000-0000-0000-000000000002',
  'a0000001-0000-0000-0000-000000000001',
  3,
  'Decent work but took longer than expected. Had to reschedule once. The pipe repair holds up fine though.',
  DATE_SUB(NOW(), INTERVAL 4 DAY)
) ON DUPLICATE KEY UPDATE rating = rating;

-- NOW the sus ones start

-- brand new account drops a 5 star with just "best" as the comment
-- no booking either. this hits multiple flags at once:
-- NEW_ACCOUNT_EXTREME (2) + NO_BOOKING (2) + GENERIC_TEXT (1) = score 5
INSERT INTO reviews (review_id, booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES (
  'r0000001-0000-0000-0000-000000000003',
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000002',
  5,
  'best',
  NOW()
) ON DUPLICATE KEY UPDATE rating = rating;

-- sock puppet account boosting the dodgy provider with a
-- copy-paste review. new account + no booking + duplicate text:
-- NEW_ACCOUNT_EXTREME (2) + NO_BOOKING (2) + DUPLICATE_TEXT (3) = score 7
INSERT INTO reviews (review_id, booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES (
  'r0000001-0000-0000-0000-000000000004',
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000004',
  'a0000001-0000-0000-0000-000000000002',
  5,
  'Absolutely perfect 10/10 best service ever would recommend to everyone!!!',
  NOW()
) ON DUPLICATE KEY UPDATE rating = rating;

-- the duplicate identity customer posts the EXACT same review
-- literally copy paste job lol
-- NEW_ACCOUNT_EXTREME (2) + NO_BOOKING (2) + DUPLICATE_TEXT (3) = score 7
INSERT INTO reviews (review_id, booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES (
  'r0000001-0000-0000-0000-000000000005',
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000005',
  'a0000001-0000-0000-0000-000000000002',
  5,
  'Absolutely perfect 10/10 best service ever would recommend to everyone!!!',
  NOW()
) ON DUPLICATE KEY UPDATE rating = rating;

-- same new user leaves ANOTHER 5 star for the same dodgy provider
-- with just "wow!!" as the comment. this adds to the burst too:
-- NO_BOOKING (2) + SHORT_TEXT (1) + BURST (2) = score 5
INSERT INTO reviews (review_id, booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES (
  'r0000001-0000-0000-0000-000000000006',
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000002',
  5,
  'wow!!',
  NOW()
) ON DUPLICATE KEY UPDATE rating = rating;

-- this one looks more believable but still flags because
-- the account is 1 day old and has no booking:
-- NEW_ACCOUNT_EXTREME (2) + NO_BOOKING (2) = score 4
INSERT INTO reviews (review_id, booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES (
  'r0000001-0000-0000-0000-000000000007',
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000001',
  1,
  'terrible service, never again',
  NOW()
) ON DUPLICATE KEY UPDATE rating = rating;

-- -------------------------------------------------------
-- what you should see when you scan:
--
-- REVIEW SCAN flags 5 reviews:
--   r4, r5 = high risk (score -7) - copy paste reviews + new accounts + no bookings
--   r3     = medium risk (score -5) - new account + generic "best" + no booking
--   r6     = medium risk (score -5) - burst of reviews + short text + no booking
--   r7     = medium risk (score -4) - new account + no booking
--   r1, r2 = NOT flagged - fatima and karim are legit
--
-- ACCOUNT SCAN flags 3-4 accounts:
--   provider "Best Plumber Rajshahi" = duplicate identity (same phone as rahim)
--   customer "Happy Customer" = sock puppet (no bookings, only reviews one provider)
--   customer "Totally Different Person" = duplicate identity (same phone as Happy Customer)
--   customer "New User 123" = reviews without bookings
-- -------------------------------------------------------
