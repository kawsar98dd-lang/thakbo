-- REFERENCE DATA for the initial market (Bangladesh -> Rajshahi) and the facility catalogue.
-- * Safe to run more than once (INSERT OR IGNORE + UNIQUE constraints).
-- * Contains NO listings, NO users and NO credentials.
-- * The area list is an INITIAL set of well-known localities. Review and extend it before launch.
-- * Area coordinates are intentionally NULL: they must be filled with verified values (admin tools, Milestone 7).
-- * The city centre below is approximate and only used as a default map centre in later milestones.
--
-- Add another city later by inserting rows here (or via admin tools). No code change is required.

INSERT OR IGNORE INTO countries (name, slug, code) VALUES ('Bangladesh', 'bangladesh', 'BD');

INSERT OR IGNORE INTO divisions (country_id, name, slug)
  SELECT id, 'Rajshahi', 'rajshahi' FROM countries WHERE slug = 'bangladesh';

INSERT OR IGNORE INTO districts (division_id, name, slug)
  SELECT id, 'Rajshahi', 'rajshahi' FROM divisions WHERE slug = 'rajshahi';

INSERT OR IGNORE INTO cities (district_id, name, slug, latitude, longitude, is_active)
  SELECT id, 'Rajshahi', 'rajshahi', 24.3745, 88.6042, 1 FROM districts WHERE slug = 'rajshahi';

INSERT OR IGNORE INTO areas (city_id, name, slug, is_active)
  SELECT c.id, a.name, a.slug, 1
  FROM cities c
  JOIN (
    SELECT 'Talaimari'   AS name, 'talaimari'   AS slug UNION ALL
    SELECT 'Shaheb Bazar',        'shaheb-bazar'        UNION ALL
    SELECT 'Kazla',               'kazla'               UNION ALL
    SELECT 'Motihar',             'motihar'             UNION ALL
    SELECT 'Binodpur',            'binodpur'            UNION ALL
    SELECT 'Upashahar',           'upashahar'           UNION ALL
    SELECT 'Laxmipur',            'laxmipur'            UNION ALL
    SELECT 'Sopura',              'sopura'
  ) a
  WHERE c.slug = 'rajshahi';

INSERT OR IGNORE INTO facilities (name, slug, icon, sort_order) VALUES
  ('Wi-Fi',              'wifi',              'wifi',        10),
  ('Meal',               'meal',              'utensils',    20),
  ('Attached bathroom',  'attached-bathroom', 'bath',        30),
  ('Kitchen',            'kitchen',           'cooking-pot', 40),
  ('Furniture',          'furniture',         'armchair',    50),
  ('Parking',            'parking',           'car',         60),
  ('Lift',               'lift',              'arrow-up-down', 70),
  ('Generator / IPS',    'generator-ips',     'zap',         80),
  ('Electricity',        'electricity',       'plug',        90),
  ('Water supply',       'water',             'droplets',   100),
  ('Gas',                'gas',               'flame',      110),
  ('CCTV',               'cctv',              'cctv',       120),
  ('Security',           'security',          'shield',     130),
  ('Caretaker',          'caretaker',         'user-check', 140);
