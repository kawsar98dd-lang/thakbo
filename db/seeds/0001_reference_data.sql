-- REFERENCE DATA for the initial market (Bangladesh -> Rajshahi) and the facility catalogue.
-- * Safe to run more than once, also on a partly seeded database (INSERT OR IGNORE + UNIQUE constraints).
-- * Contains NO listings, NO users and NO credentials.
-- * The area list is an INITIAL set of well-known localities. Review and extend it before launch.
-- * Area coordinates are intentionally NULL: they must be filled with verified values (admin tools, Milestone 7).
-- * The city centre below is approximate and only used as a default map centre in later milestones.
-- * D1-compatible: no compound SELECT chains and at most 5 rows per VALUES list. Production D1 rejects long
--   compound SELECT chains ("too many terms in compound SELECT") that a normal local SQLite accepts.
--
-- Add another city later by inserting rows here (or via admin tools). No code change is required.

INSERT OR IGNORE INTO countries (name, slug, code) VALUES ('Bangladesh', 'bangladesh', 'BD');

INSERT OR IGNORE INTO divisions (country_id, name, slug)
  SELECT id, 'Rajshahi', 'rajshahi' FROM countries WHERE slug = 'bangladesh';

INSERT OR IGNORE INTO districts (division_id, name, slug)
  SELECT id, 'Rajshahi', 'rajshahi' FROM divisions WHERE slug = 'rajshahi';

INSERT OR IGNORE INTO cities (district_id, name, slug, latitude, longitude, is_active)
  SELECT id, 'Rajshahi', 'rajshahi', 24.3745, 88.6042, 1 FROM districts WHERE slug = 'rajshahi';

INSERT OR IGNORE INTO areas (city_id, name, slug, is_active) VALUES
  ((SELECT id FROM cities WHERE slug = 'rajshahi'), 'Talaimari',    'talaimari',    1),
  ((SELECT id FROM cities WHERE slug = 'rajshahi'), 'Shaheb Bazar', 'shaheb-bazar', 1),
  ((SELECT id FROM cities WHERE slug = 'rajshahi'), 'Kazla',        'kazla',        1),
  ((SELECT id FROM cities WHERE slug = 'rajshahi'), 'Motihar',      'motihar',      1),
  ((SELECT id FROM cities WHERE slug = 'rajshahi'), 'Binodpur',     'binodpur',     1);

INSERT OR IGNORE INTO areas (city_id, name, slug, is_active) VALUES
  ((SELECT id FROM cities WHERE slug = 'rajshahi'), 'Upashahar',    'upashahar',    1),
  ((SELECT id FROM cities WHERE slug = 'rajshahi'), 'Laxmipur',     'laxmipur',     1),
  ((SELECT id FROM cities WHERE slug = 'rajshahi'), 'Sopura',       'sopura',       1);

INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES
  ('Wi-Fi',              'wifi',              'wifi',        10),
  ('Meal',               'meal',              'utensils',    20),
  ('Attached bathroom',  'attached-bathroom', 'bath',        30),
  ('Kitchen',            'kitchen',           'cooking-pot', 40),
  ('Furniture',          'furniture',         'armchair',    50);

INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES
  ('Parking',            'parking',           'car',         60),
  ('Lift',               'lift',              'arrow-up-down', 70),
  ('Generator / IPS',    'generator-ips',     'zap',         80),
  ('Electricity',        'electricity',       'plug',        90),
  ('Water supply',       'water',             'droplets',   100);

INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES
  ('Gas',                'gas',               'flame',      110),
  ('CCTV',               'cctv',              'cctv',       120),
  ('Security',           'security',          'shield',     130),
  ('Caretaker',          'caretaker',         'user-check', 140);
