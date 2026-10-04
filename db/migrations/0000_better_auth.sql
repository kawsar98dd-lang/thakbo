-- Migration 0000: Better Auth core tables (user, session, account, verification, rateLimit).
-- Column names are camelCase on purpose: Better Auth's Kysely adapter expects them.
-- Dates are stored as ISO-8601 text, booleans as 0/1 (SQLite has no native types for either).

CREATE TABLE "user" (
  "id"            TEXT    NOT NULL PRIMARY KEY,
  "name"          TEXT    NOT NULL,
  "email"         TEXT    NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0 CHECK ("emailVerified" IN (0, 1)),
  "image"         TEXT,
  "createdAt"     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "session" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TEXT NOT NULL,
  "token"     TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId"    TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);
CREATE INDEX "idx_session_userId" ON "session" ("userId");

CREATE TABLE "account" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "accountId"             TEXT NOT NULL,
  "providerId"            TEXT NOT NULL,
  "userId"                TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken"           TEXT,
  "refreshToken"          TEXT,
  "idToken"               TEXT,
  "accessTokenExpiresAt"  TEXT,
  "refreshTokenExpiresAt" TEXT,
  "scope"                 TEXT,
  "password"              TEXT,
  "createdAt"             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "idx_account_userId" ON "account" ("userId");

CREATE TABLE "verification" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expiresAt"  TEXT NOT NULL,
  "createdAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "idx_verification_identifier" ON "verification" ("identifier");

-- Durable rate limiting for auth endpoints (in-memory limits do not work across Worker isolates).
CREATE TABLE "rateLimit" (
  "id"          TEXT    NOT NULL PRIMARY KEY,
  "key"         TEXT    NOT NULL UNIQUE,
  "count"       INTEGER NOT NULL,
  "lastRequest" INTEGER NOT NULL
);
