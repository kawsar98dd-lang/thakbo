-- Migration 0009: public contact form inbox (additive only).
-- Messages are retained for admin review; no email provider is required.
CREATE TABLE contact_messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  email       TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  subject     TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 3 AND 160),
  message     TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 10 AND 3000),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  admin_note  TEXT CHECK (admin_note IS NULL OR length(admin_note) <= 1000),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_contact_messages_status_created ON contact_messages (status, created_at DESC);
CREATE INDEX idx_contact_messages_email_created ON contact_messages (email, created_at DESC);
