-- Migration 0001: THAKBO profiles and admin roles (one account system: every user can search AND list).

CREATE TABLE profiles (
  user_id      TEXT NOT NULL PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone        TEXT,
  whatsapp     TEXT,
  bio          TEXT,
  avatar_url   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Admin access is decided ONLY by a row in this table, checked on the server.
CREATE TABLE admin_users (
  user_id    TEXT NOT NULL PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
