-- Migration 0006: NEIGHBORHOOD-FIRST location model (extends 0002 — nothing is dropped or recreated).
--
-- Hierarchy:  country → division → district → city → area (neighborhood) → optional sub-area.
-- * `areas` is the first-class "local place people actually use" (Hetem Khan, Ghoshpara, Shaheb Bazar, ...).
--   A SUB-AREA is simply an area whose parent_area_id points at another area of the SAME city (rule enforced in code).
-- * Administrative data (thana, ward) is optional METADATA only; users never have to choose it.
-- * `area_aliases` maps every known spelling (Bangla, English, transliterations) to ONE canonical area.
--   normalized_alias is produced by normalizeLocationText() in app/lib/location.ts.
--   UNIQUE (city_id, normalized_alias) makes an ambiguous alias impossible inside one city.
-- * Listings get an optional sub_area_id and a landmark text; area_id keeps pointing to the canonical neighborhood.

ALTER TABLE countries ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
ALTER TABLE divisions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
ALTER TABLE districts ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

ALTER TABLE cities ADD COLUMN name_en TEXT;
ALTER TABLE cities ADD COLUMN name_bn TEXT;
UPDATE cities SET name_en = name WHERE name_en IS NULL;

ALTER TABLE areas ADD COLUMN name_en TEXT;
ALTER TABLE areas ADD COLUMN name_bn TEXT;
ALTER TABLE areas ADD COLUMN area_type TEXT NOT NULL DEFAULT 'neighborhood'
  CHECK (area_type IN ('neighborhood', 'para', 'residential_area', 'market_area', 'commercial_area',
                       'campus_area', 'landmark_area', 'road_area', 'other'));
ALTER TABLE areas ADD COLUMN parent_area_id INTEGER REFERENCES areas (id) ON DELETE RESTRICT;
ALTER TABLE areas ADD COLUMN radius_m INTEGER CHECK (radius_m IS NULL OR radius_m > 0);
ALTER TABLE areas ADD COLUMN thana TEXT;
ALTER TABLE areas ADD COLUMN ward TEXT;
ALTER TABLE areas ADD COLUMN description TEXT;
ALTER TABLE areas ADD COLUMN search_priority INTEGER NOT NULL DEFAULT 0;
UPDATE areas SET name_en = name WHERE name_en IS NULL;

CREATE INDEX idx_areas_parent_area_id ON areas (parent_area_id);
-- Default neighborhood list for a city: active only, most important first.
CREATE INDEX idx_areas_city_priority ON areas (city_id, is_active, search_priority DESC, name);

CREATE TABLE area_aliases (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id          INTEGER NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
  city_id          INTEGER NOT NULL REFERENCES cities (id) ON DELETE CASCADE,
  alias            TEXT NOT NULL CHECK (length(trim(alias)) > 0),
  normalized_alias TEXT NOT NULL CHECK (length(normalized_alias) > 0),
  language         TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'bn', 'mixed')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Doubles as the index for exact and prefix lookups inside one city.
  UNIQUE (city_id, normalized_alias)
);
CREATE INDEX idx_area_aliases_area_id ON area_aliases (area_id);

ALTER TABLE listings ADD COLUMN sub_area_id INTEGER REFERENCES areas (id) ON DELETE RESTRICT;
ALTER TABLE listings ADD COLUMN landmark TEXT;
CREATE INDEX idx_listings_sub_area_id ON listings (sub_area_id);

-- Optional preferred city (profile foundation). SET NULL keeps the profile if a city is ever removed.
ALTER TABLE profiles ADD COLUMN preferred_city_id INTEGER REFERENCES cities (id) ON DELETE SET NULL;
