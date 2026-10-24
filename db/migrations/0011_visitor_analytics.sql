-- Migration 0011: privacy-conscious visitor analytics.
-- Stores daily aggregates and short-lived pseudonymous deduplication keys only; no raw IPs or user IDs.
CREATE TABLE analytics_daily_views (
  day TEXT NOT NULL,
  page_key TEXT NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('page', 'listing')),
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  PRIMARY KEY (day, page_key)
) WITHOUT ROWID;
CREATE INDEX idx_analytics_daily_day_type ON analytics_daily_views(day, page_type);
CREATE INDEX idx_analytics_daily_listing ON analytics_daily_views(listing_id, day) WHERE listing_id IS NOT NULL;

CREATE TABLE analytics_view_dedup (
  day TEXT NOT NULL,
  page_key TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, page_key, visitor_hash)
) WITHOUT ROWID;
CREATE INDEX idx_analytics_dedup_created ON analytics_view_dedup(created_at);
