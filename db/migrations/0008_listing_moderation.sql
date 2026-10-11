-- Migration 0008: listing submission and moderation (ADDITIVE ONLY: no existing column, table or row is changed).
-- Adds review columns to `listings`, an append-only moderation history table, and database triggers that
--   1. allow only the documented status transitions,
--   2. refuse a moderation decision unless a DIFFERENT, registered admin/moderator made it (no self-approval),
--   3. require a photo before a listing can enter review and a 10-500 character reason for a rejection,
--   4. write one history row for EVERY status change, whatever code path made it.

ALTER TABLE listings ADD COLUMN submitted_at TEXT;
ALTER TABLE listings ADD COLUMN reviewed_at TEXT;
ALTER TABLE listings ADD COLUMN reviewed_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL;
ALTER TABLE listings ADD COLUMN rejection_reason TEXT CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 500);

CREATE INDEX idx_listings_status_submitted ON listings (status, submitted_at);

CREATE TABLE listing_moderation_events (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  actor_id    TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
  actor_role  TEXT NOT NULL CHECK (actor_role IN ('owner', 'admin', 'moderator')),
  action      TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'reject', 'unpublish', 'withdraw', 'pause', 'delete')),
  from_status TEXT NOT NULL CHECK (from_status IN ('draft', 'pending', 'published', 'paused', 'rejected', 'deleted')),
  to_status   TEXT NOT NULL CHECK (to_status IN ('draft', 'pending', 'published', 'paused', 'rejected', 'deleted')),
  reason      TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_listing_moderation_events_listing ON listing_moderation_events (listing_id, created_at);
CREATE INDEX idx_listing_moderation_events_actor ON listing_moderation_events (actor_id);

CREATE TRIGGER trg_listings_status_guard
BEFORE UPDATE OF status ON listings
FOR EACH ROW
WHEN NEW.status <> OLD.status
BEGIN
  SELECT RAISE(ABORT, 'invalid listing status transition')
  WHERE NOT (
    (OLD.status = 'draft' AND NEW.status IN ('pending', 'deleted'))
    OR (OLD.status = 'pending' AND NEW.status IN ('published', 'rejected', 'draft', 'deleted'))
    OR (OLD.status = 'published' AND NEW.status IN ('pending', 'paused', 'draft', 'deleted'))
    OR (OLD.status = 'paused' AND NEW.status IN ('pending', 'draft', 'deleted'))
    OR (OLD.status = 'rejected' AND NEW.status IN ('pending', 'draft', 'deleted'))
  );
  SELECT RAISE(ABORT, 'a listing needs at least one image before review')
  WHERE NEW.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM listing_images WHERE listing_id = NEW.id);
  SELECT RAISE(ABORT, 'a moderation decision needs a different, registered reviewer')
  WHERE OLD.status = 'pending' AND NEW.status IN ('published', 'rejected')
    AND (
      NEW.reviewed_by IS NULL
      OR NEW.reviewed_by = NEW.owner_id
      OR NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = NEW.reviewed_by)
    );
  SELECT RAISE(ABORT, 'a rejection needs a reason of 10 to 500 characters')
  WHERE NEW.status = 'rejected'
    AND (NEW.rejection_reason IS NULL OR length(trim(NEW.rejection_reason)) < 10 OR length(NEW.rejection_reason) > 500);
END;

CREATE TRIGGER trg_listings_status_history
AFTER UPDATE OF status ON listings
FOR EACH ROW
WHEN NEW.status <> OLD.status
BEGIN
  INSERT INTO listing_moderation_events (id, listing_id, actor_id, actor_role, action, from_status, to_status, reason)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    CASE WHEN OLD.status = 'pending' AND NEW.status IN ('published', 'rejected') THEN NEW.reviewed_by ELSE NEW.owner_id END,
    CASE WHEN OLD.status = 'pending' AND NEW.status IN ('published', 'rejected')
      THEN (SELECT role FROM admin_users WHERE user_id = NEW.reviewed_by)
      ELSE 'owner' END,
    CASE
      WHEN NEW.status = 'published' THEN 'approve'
      WHEN NEW.status = 'rejected' THEN 'reject'
      WHEN NEW.status = 'pending' AND OLD.status = 'published' THEN 'unpublish'
      WHEN NEW.status = 'pending' THEN 'submit'
      WHEN NEW.status = 'paused' THEN 'pause'
      WHEN NEW.status = 'deleted' THEN 'delete'
      WHEN NEW.status = 'draft' AND OLD.status IN ('published', 'paused') THEN 'unpublish'
      ELSE 'withdraw'
    END,
    OLD.status,
    NEW.status,
    CASE WHEN NEW.status = 'rejected' THEN NEW.rejection_reason ELSE NULL END
  );
END;
