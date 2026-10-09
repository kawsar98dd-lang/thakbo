-- SEED 0002: Rajshahi neighborhoods, their aliases, and bilingual facility labels.
-- GENERATED from a reviewed list; the `normalized_alias` values are produced by normalizeLocationText()
-- (app/lib/location.ts). tests/location-repository.test.ts re-computes every value and fails on any mismatch.
--
-- * Idempotent: INSERT OR IGNORE + UPDATE keyed by slug. Safe to run any number of times, also on a partly seeded database.
-- * D1-compatible: no compound SELECT chains and at most 5 rows per VALUES list (production D1 limits compound SELECTs
--   far below normal SQLite). scripts/production_db.py and the tests enforce this.
-- * Contains NO listings and NO users.
-- * This is only a BOOTSTRAP list (representative well-known places). Rajshahi has many more neighborhoods; add them
--   with the location service (app/server/db/repositories/locations.ts) or by extending this list.
-- * Coordinates are intentionally NULL: they must be filled in with verified values, not invented.
-- * Bangla spellings should be reviewed by a local before launch; extra spellings are added as aliases.

UPDATE cities SET name_bn = 'রাজশাহী' WHERE slug = 'rajshahi';

INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Hetem Khan', 'hetem-khan', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Ghoshpara', 'ghoshpara', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Shaheb Bazar', 'shaheb-bazar', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Talaimari', 'talaimari', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Kazla', 'kazla', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Motihar', 'motihar', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Binodpur', 'binodpur', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Upashahar', 'upashahar', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Laxmipur', 'laxmipur', 1 FROM cities WHERE slug = 'rajshahi';
INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT id, 'Sopura', 'sopura', 1 FROM cities WHERE slug = 'rajshahi';

UPDATE areas SET name_en = 'Hetem Khan', name_bn = 'হেতেম খান', area_type = 'neighborhood', search_priority = 90
  WHERE slug = 'hetem-khan' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Ghoshpara', name_bn = 'ঘোষপাড়া', area_type = 'para', search_priority = 80
  WHERE slug = 'ghoshpara' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Shaheb Bazar', name_bn = 'সাহেব বাজার', area_type = 'market_area', search_priority = 100
  WHERE slug = 'shaheb-bazar' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Talaimari', name_bn = 'তালাইমারী', area_type = 'neighborhood', search_priority = 70
  WHERE slug = 'talaimari' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Kazla', name_bn = 'কাজলা', area_type = 'neighborhood', search_priority = 50
  WHERE slug = 'kazla' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Motihar', name_bn = 'মতিহার', area_type = 'neighborhood', search_priority = 50
  WHERE slug = 'motihar' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Binodpur', name_bn = 'বিনোদপুর', area_type = 'neighborhood', search_priority = 50
  WHERE slug = 'binodpur' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Upashahar', name_bn = 'উপশহর', area_type = 'residential_area', search_priority = 50
  WHERE slug = 'upashahar' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Laxmipur', name_bn = 'লক্ষ্মীপুর', area_type = 'neighborhood', search_priority = 50
  WHERE slug = 'laxmipur' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');
UPDATE areas SET name_en = 'Sopura', name_bn = 'সপুরা', area_type = 'neighborhood', search_priority = 50
  WHERE slug = 'sopura' AND city_id = (SELECT id FROM cities WHERE slug = 'rajshahi');

INSERT OR IGNORE INTO area_aliases (area_id, city_id, alias, normalized_alias, language) VALUES
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'hetem-khan'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Hetem Khan', 'hetemkhan', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'hetem-khan'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'হেতেম খান', 'হেতেমখান', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'hetem-khan'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Hatem Khan', 'hatemkhan', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'hetem-khan'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'হেটেম খান', 'হেটেমখান', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'hetem-khan'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'হাতেম খান', 'হাতেমখান', 'bn');

INSERT OR IGNORE INTO area_aliases (area_id, city_id, alias, normalized_alias, language) VALUES
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'ghoshpara'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Ghoshpara', 'ghoshpara', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'ghoshpara'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'ঘোষপাড়া', 'ঘোষপাড়া', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'shaheb-bazar'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Shaheb Bazar', 'shahebazar', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'shaheb-bazar'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'সাহেব বাজার', 'সাহেববাজার', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'shaheb-bazar'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Saheb Bazar', 'sahebazar', 'en');

INSERT OR IGNORE INTO area_aliases (area_id, city_id, alias, normalized_alias, language) VALUES
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'talaimari'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Talaimari', 'talaimari', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'talaimari'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'তালাইমারী', 'তালাইমারী', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'talaimari'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'তালাইমারি', 'তালাইমারি', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'kazla'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Kazla', 'kazla', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'kazla'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'কাজলা', 'কাজলা', 'bn');

INSERT OR IGNORE INTO area_aliases (area_id, city_id, alias, normalized_alias, language) VALUES
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'motihar'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Motihar', 'motihar', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'motihar'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'মতিহার', 'মতিহার', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'binodpur'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Binodpur', 'binodpur', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'binodpur'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'বিনোদপুর', 'বিনোদপুর', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'upashahar'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Upashahar', 'upashahar', 'en');

INSERT OR IGNORE INTO area_aliases (area_id, city_id, alias, normalized_alias, language) VALUES
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'upashahar'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'উপশহর', 'উপশহর', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'laxmipur'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Laxmipur', 'laxmipur', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'laxmipur'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'লক্ষ্মীপুর', 'লক্ষ্মীপুর', 'bn'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'sopura'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'Sopura', 'sopura', 'en'),
  ((SELECT a.id FROM areas a JOIN cities c ON c.id = a.city_id WHERE c.slug = 'rajshahi' AND a.slug = 'sopura'), (SELECT id FROM cities WHERE slug = 'rajshahi'), 'সপুরা', 'সপুরা', 'bn');

-- Facilities: new catalogue entries (INSERT OR IGNORE), then bilingual labels and categories for all.
INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES ('Shared bathroom', 'shared-bathroom', 'bath', 31);
INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES ('Furnished', 'furnished', 'armchair', 51);
INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES ('Semi-furnished', 'semi-furnished', 'armchair', 52);
INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES ('Balcony', 'balcony', 'door-open', 150);
INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES ('Dining', 'dining', 'utensils', 160);
INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES ('Fan', 'fan', 'fan', 170);
INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES ('AC', 'ac', 'snowflake', 180);
INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES ('Washing machine', 'washing-machine', 'washing-machine', 190);

UPDATE facilities SET name_en = 'Wi-Fi', name_bn = 'ওয়াই-ফাই', category = 'connectivity' WHERE slug = 'wifi';
UPDATE facilities SET name_en = 'Meal', name_bn = 'খাবার', category = 'kitchen_dining' WHERE slug = 'meal';
UPDATE facilities SET name_en = 'Attached bathroom', name_bn = 'অ্যাটাচ্ড বাথরুম', category = 'bathroom' WHERE slug = 'attached-bathroom';
UPDATE facilities SET name_en = 'Kitchen', name_bn = 'রান্নাঘর', category = 'kitchen_dining' WHERE slug = 'kitchen';
UPDATE facilities SET name_en = 'Furniture', name_bn = 'আসবাবপত্র', category = 'furnishing' WHERE slug = 'furniture';
UPDATE facilities SET name_en = 'Parking', name_bn = 'পার্কিং', category = 'building' WHERE slug = 'parking';
UPDATE facilities SET name_en = 'Lift', name_bn = 'লিফট', category = 'building' WHERE slug = 'lift';
UPDATE facilities SET name_en = 'Generator / IPS', name_bn = 'জেনারেটর / আইপিএস', category = 'utilities' WHERE slug = 'generator-ips';
UPDATE facilities SET name_en = 'Electricity', name_bn = 'বিদ্যুৎ', category = 'utilities' WHERE slug = 'electricity';
UPDATE facilities SET name_en = 'Water supply', name_bn = 'পানি সরবরাহ', category = 'utilities' WHERE slug = 'water';
UPDATE facilities SET name_en = 'Gas', name_bn = 'গ্যাস', category = 'utilities' WHERE slug = 'gas';
UPDATE facilities SET name_en = 'CCTV', name_bn = 'সিসিটিভি', category = 'safety' WHERE slug = 'cctv';
UPDATE facilities SET name_en = 'Security', name_bn = 'নিরাপত্তা', category = 'safety' WHERE slug = 'security';
UPDATE facilities SET name_en = 'Caretaker', name_bn = 'কেয়ারটেকার', category = 'safety' WHERE slug = 'caretaker';
UPDATE facilities SET name_en = 'Shared bathroom', name_bn = 'শেয়ার্ড বাথরুম', category = 'bathroom' WHERE slug = 'shared-bathroom';
UPDATE facilities SET name_en = 'Furnished', name_bn = 'ফার্নিশড (সাজানো)', category = 'furnishing' WHERE slug = 'furnished';
UPDATE facilities SET name_en = 'Semi-furnished', name_bn = 'আংশিক ফার্নিশড', category = 'furnishing' WHERE slug = 'semi-furnished';
UPDATE facilities SET name_en = 'Balcony', name_bn = 'বারান্দা', category = 'comfort' WHERE slug = 'balcony';
UPDATE facilities SET name_en = 'Dining', name_bn = 'ডাইনিং', category = 'kitchen_dining' WHERE slug = 'dining';
UPDATE facilities SET name_en = 'Fan', name_bn = 'ফ্যান', category = 'comfort' WHERE slug = 'fan';
UPDATE facilities SET name_en = 'AC', name_bn = 'এসি', category = 'comfort' WHERE slug = 'ac';
UPDATE facilities SET name_en = 'Washing machine', name_bn = 'ওয়াশিং মেশিন', category = 'utilities' WHERE slug = 'washing-machine';
