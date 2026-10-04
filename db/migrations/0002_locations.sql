-- Migration 0002: location hierarchy  country -> division -> district -> city -> area.
-- Rajshahi is only DATA (see db/seeds). Nothing in the schema is specific to one city.
-- City slug is globally unique (URL: /city/:city). Area slug is unique per city (URL: /area/:city/:area).

CREATE TABLE countries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  code       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE divisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id INTEGER NOT NULL REFERENCES countries (id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (country_id, slug)
);

CREATE TABLE districts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  division_id INTEGER NOT NULL REFERENCES divisions (id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (division_id, slug)
);

CREATE TABLE cities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id INTEGER NOT NULL REFERENCES districts (id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  latitude    REAL CHECK (latitude  BETWEEN -90  AND 90),
  longitude   REAL CHECK (longitude BETWEEN -180 AND 180),
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE areas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id    INTEGER NOT NULL REFERENCES cities (id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  latitude   REAL CHECK (latitude  BETWEEN -90  AND 90),
  longitude  REAL CHECK (longitude BETWEEN -180 AND 180),
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (city_id, slug)
);

CREATE INDEX idx_divisions_country_id ON divisions (country_id);
CREATE INDEX idx_districts_division_id ON districts (division_id);
CREATE INDEX idx_cities_district_id ON cities (district_id);
CREATE INDEX idx_areas_city_id ON areas (city_id);
CREATE INDEX idx_areas_slug ON areas (slug);
