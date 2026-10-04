-- Migration 0005: saved listings and user reports.

CREATE TABLE favorites (
  user_id    TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings ("id") ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, listing_id)
) WITHOUT ROWID;
CREATE INDEX idx_favorites_listing_id ON favorites (listing_id);

-- reporter_id is SET NULL when an account is removed so moderation history survives.
CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  reporter_id TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
  reason      TEXT NOT NULL CHECK (reason IN (
    'fake_listing', 'wrong_information', 'already_rented',
    'inappropriate_content', 'spam', 'duplicate', 'other'
  )),
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_note  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_reports_listing_id  ON reports (listing_id);
CREATE INDEX idx_reports_status      ON reports (status);
CREATE INDEX idx_reports_reporter_id ON reports (reporter_id);
