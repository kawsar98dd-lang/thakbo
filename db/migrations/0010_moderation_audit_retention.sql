-- Migration 0010: preserve moderation audit history.
-- Audit events are immutable, and listings with audit history cannot be physically deleted.
-- Normal user-facing deletion must use the existing `deleted` status transition.

CREATE TRIGGER trg_listing_moderation_events_no_update
BEFORE UPDATE ON listing_moderation_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'moderation audit events are immutable');
END;

CREATE TRIGGER trg_listing_moderation_events_no_delete
BEFORE DELETE ON listing_moderation_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'moderation audit events cannot be deleted');
END;

CREATE TRIGGER trg_listings_audit_retention_guard
BEFORE DELETE ON listings
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM listing_moderation_events WHERE listing_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'listing has moderation history; use deleted status to retain audit trail');
END;
