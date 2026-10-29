-- =====================================================
-- Photos for the seeded services (image_url, added in
-- migrations/003_add_service_image.sql). The URLs match
-- the ones in servicehub/src/data/services.js.
--
-- Idempotent: only fills services that have no photo yet,
-- so an image set by an admin is never overwritten.
-- =====================================================

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952'
WHERE service_name = 'Home Cleaning' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c'
WHERE service_name = 'Moving Help' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1604357209793-fca5dca89f97'
WHERE service_name = 'Local Delivery' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3'
WHERE service_name = 'Tech Support' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4'
WHERE service_name = 'AC Repair' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e'
WHERE service_name = 'Electrician' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39'
WHERE service_name = 'Plumbing Help' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1509062522246-3755977927d7'
WHERE service_name = 'Home Tutoring' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309'
WHERE service_name = 'Elder Care Visit' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39'
WHERE service_name = 'Plumbing' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e'
WHERE service_name = 'Electrical' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952'
WHERE service_name = 'Cleaning' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b'
WHERE service_name = 'Gardening' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c'
WHERE service_name = 'Moving' AND image_url IS NULL;

UPDATE services SET image_url = 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4'
WHERE service_name = 'HVAC' AND image_url IS NULL;
