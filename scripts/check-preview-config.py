#!/usr/bin/env python3
"""Read-only report for THAKBO's Cloudflare Worker Preview readiness.

Usage:
  python3 scripts/check-preview-config.py          # report, exit 0 even if account setup is pending
  python3 scripts/check-preview-config.py --strict # exit 1 when required resource IDs/bindings are missing

This script never calls Cloudflare, creates resources, deploys, or reads secrets.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "wrangler.jsonc"


def remove_jsonc_comments(source: str) -> str:
    """Remove // and /* */ comments without changing comment-like text inside strings."""
    out: list[str] = []
    i = 0
    in_string = False
    escaped = False
    while i < len(source):
        ch = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ""
        if in_string:
            out.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
        elif ch == "/" and nxt == "/":
            i += 2
            while i < len(source) and source[i] not in "\r\n":
                i += 1
        elif ch == "/" and nxt == "*":
            i += 2
            while i + 1 < len(source) and source[i:i + 2] != "*/":
                i += 1
            if i + 1 >= len(source):
                raise ValueError("Unterminated block comment in wrangler.jsonc")
            i += 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def load_config() -> dict:
    try:
        return json.loads(remove_jsonc_comments(CONFIG.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(f"Could not parse {CONFIG.name}: {exc}") from exc


def inspect(config: dict) -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    prod_d1 = config.get("d1_databases") or []
    prod = next((b for b in prod_d1 if b.get("binding") == "DB"), None)
    if not prod:
        findings.append(("BLOCKER", "Production D1 binding DB is missing from d1_databases."))
    elif not prod.get("database_id") or not str(prod.get("database_id")).strip():
        # The checker cannot verify the authenticated deploy path. Do not promise automatic
        # provisioning; require the owner to confirm the real account-specific ID before release.
        findings.append(("WARNING", "Production D1 binding has no database_id. This repository check cannot verify whether your authenticated deploy path can provision it. For predictable deployment and migrations, create/identify thakbo-db and set its real ID before release."))
    else:
        findings.append(("OK", "Production D1 binding includes a database_id."))

    previews = config.get("previews")
    if not isinstance(previews, dict):
        findings.append(("BLOCKER", "The required previews block is missing or is not an object."))
        previews = {}
    else:
        findings.append(("OK", "A Wrangler previews block exists."))

    preview_d1 = previews.get("d1_databases") or []
    preview_db = next((b for b in preview_d1 if b.get("binding") == "DB"), None)
    if not preview_db:
        findings.append(("BLOCKER", "Preview has no separate D1 binding named DB. Add a preview-safe D1 database; do not point a preview at production data."))
    elif not preview_db.get("database_name") or not str(preview_db.get("database_name")).strip():
        findings.append(("BLOCKER", "Preview D1 binding DB has no database_name; give it a distinct account resource name."))
    elif prod and prod.get("database_name") and preview_db.get("database_name") == prod.get("database_name"):
        findings.append(("BLOCKER", "Preview D1 database_name matches production. Use a separate preview database name."))
    elif not preview_db.get("database_id") or not str(preview_db.get("database_id")).strip():
        findings.append(("BLOCKER", "Preview D1 binding DB has no database_id. Configure a real Preview D1 ID; do not rely on automatic provisioning for an isolated Preview."))
    elif prod and prod.get("database_id") and preview_db.get("database_id") == prod.get("database_id"):
        findings.append(("BLOCKER", "Preview D1 database_id matches production. Refusing unsafe shared database configuration."))
    else:
        findings.append(("OK", "Preview DB has its own name and configured ID, separate from production."))

    prod_r2 = config.get("r2_buckets") or []
    prod_media = next((b for b in prod_r2 if b.get("binding") == "MEDIA_BUCKET"), None)
    preview_r2 = previews.get("r2_buckets") or []
    media = next((b for b in preview_r2 if b.get("binding") == "MEDIA_BUCKET"), None)
    if not media or not media.get("bucket_name"):
        findings.append(("BLOCKER", "Preview has no MEDIA_BUCKET R2 binding."))
    elif prod_media and prod_media.get("bucket_name") and media.get("bucket_name") == prod_media.get("bucket_name"):
        findings.append(("BLOCKER", "Preview MEDIA_BUCKET name matches production. Use a separate Preview R2 bucket to avoid mixing uploaded images."))
    else:
        findings.append(("CHECK IN CLOUDFLARE", f"Preview R2 bucket is configured as {media['bucket_name']!r}; this script cannot verify that the bucket exists in the connected account."))

    vars_ = previews.get("vars") or {}
    if vars_.get("APP_NAME") != "thakbo-preview":
        findings.append(("WARNING", "Preview APP_NAME is not set to thakbo-preview."))
    else:
        findings.append(("OK", "Preview APP_NAME is separated from production."))
    findings.append(("MANUAL", "Preview secrets (especially BETTER_AUTH_SECRET and any required BETTER_AUTH_URL) must be set in Cloudflare Preview Base configuration; they cannot be verified from this repository."))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="exit non-zero if any BLOCKER is present")
    args = parser.parse_args()
    try:
        config = load_config()
        findings = inspect(config)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    blockers = 0
    print("THAKBO Cloudflare Preview readiness report (read-only)")
    print(f"Config: {CONFIG.relative_to(ROOT)}")
    for status, message in findings:
        print(f"[{status}] {message}")
        blockers += status == "BLOCKER"
    print(f"\nBlockers: {blockers}")
    if blockers:
        print("No Cloudflare resources were created or changed. Fill in real, separate resource IDs before deployment.")
    return 1 if args.strict and blockers else 0


if __name__ == "__main__":
    raise SystemExit(main())
