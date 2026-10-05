-- Migration 0007: bilingual facility labels + wider audience list.

ALTER TABLE facilities ADD COLUMN name_en TEXT;
ALTER TABLE facilities ADD COLUMN name_bn TEXT;
ALTER TABLE facilities ADD COLUMN category TEXT;
UPDATE facilities SET name_en = name WHERE name_en IS NULL;

-- SQLite cannot change a CHECK constraint in place, so listing_audiences (a small link table that no other table
-- references) is rebuilt with the extended audience list. Existing rows are copied unchanged.
CREATE TABLE listing_audiences_new (
  listing_id TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  audience   TEXT NOT NULL CHECK (audience IN ('student', 'bachelor', 'family', 'male', 'female', 'mixed', 'anyone')),
  PRIMARY KEY (listing_id, audience)
) WITHOUT ROWID;
INSERT INTO listing_audiences_new (listing_id, audience) SELECT listing_id, audience FROM listing_audiences;
DROP TABLE listing_audiences;
ALTER TABLE listing_audiences_new RENAME TO listing_audiences;
