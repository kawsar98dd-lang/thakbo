#!/usr/bin/env python3
"""Create a NON-DESTRUCTIVE R2 orphan-candidate report from exported inventories.

Inputs are JSON files:
  D1 export: {"object_keys": ["listings/<listing-uuid>/<image-uuid>.jpg", ...]}
  R2 inventory: {"objects": [{"key": "...", "uploaded_at": "2025-01-01T00:00:00Z"}, ...]}

This tool never calls Cloudflare and never deletes objects. It only reports keys that
are absent from the supplied D1 snapshot, match THAKBO's strict generated-key format,
and are older than the requested retention period. The inventory timestamps must be
UTC ISO-8601 strings ending in Z. A fresh/incorrect/incomplete snapshot can produce
false candidates; review the output and re-check live D1 references before any deletion.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

KEY_RE = re.compile(
    r"^listings/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/"
    r"([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|png|webp)$"
)


def parse_time(value: str) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError("uploaded_at must be a UTC ISO-8601 timestamp ending in Z")
    try:
        return datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise ValueError(f"invalid uploaded_at timestamp: {value}") from exc


def load_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read valid JSON from {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def build_report(d1: dict, r2: dict, now: datetime, retention_days: int) -> dict:
    keys = d1.get("object_keys")
    objects = r2.get("objects")
    if not isinstance(keys, list) or any(not isinstance(key, str) for key in keys):
        raise ValueError('D1 input must contain "object_keys": [string, ...]')
    if not isinstance(objects, list) or any(not isinstance(obj, dict) for obj in objects):
        raise ValueError('R2 input must contain "objects": [{"key": string, "uploaded_at": timestamp}, ...]')
    if retention_days < 1:
        raise ValueError("retention_days must be at least 1")
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")

    referenced = set(keys)
    cutoff = now.astimezone(timezone.utc) - timedelta(days=retention_days)
    candidates = []
    skipped = {"referenced": 0, "invalid_key": 0, "too_recent": 0}
    seen = set()
    for obj in objects:
        key = obj.get("key")
        if not isinstance(key, str):
            raise ValueError("every R2 object must have a string key")
        if key in seen:
            continue
        seen.add(key)
        if key in referenced:
            skipped["referenced"] += 1
            continue
        if not KEY_RE.fullmatch(key):
            skipped["invalid_key"] += 1
            continue
        uploaded_at = parse_time(obj.get("uploaded_at"))
        if uploaded_at > cutoff:
            skipped["too_recent"] += 1
            continue
        candidates.append({"key": key, "uploaded_at": uploaded_at.isoformat().replace("+00:00", "Z")})

    candidates.sort(key=lambda item: item["key"])
    return {
        "mode": "DRY_RUN_ONLY_NO_DELETIONS",
        "generated_at": now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "retention_days": retention_days,
        "cutoff_utc": cutoff.isoformat().replace("+00:00", "Z"),
        "counts": {"d1_referenced_keys": len(referenced), "r2_unique_keys": len(seen), "candidate_count": len(candidates), **skipped},
        "candidates": candidates,
        "required_before_any_deletion": [
            "Re-export D1 and R2 inventories close together; do not use stale snapshots.",
            "Confirm each candidate is not referenced by any live listing_images row.",
            "Review the retention policy and obtain explicit operational approval.",
            "Use a separate reviewed deletion process; this script has no delete capability.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--d1-json", required=True, type=Path, help="D1 object_key export JSON")
    parser.add_argument("--r2-json", required=True, type=Path, help="R2 inventory JSON")
    parser.add_argument("--retention-days", type=int, default=30)
    parser.add_argument("--now", help="fixed UTC time for repeatable reports, e.g. 2026-10-14T12:00:00Z")
    parser.add_argument("--output", type=Path, help="write report JSON to this path (default: stdout)")
    args = parser.parse_args()
    try:
        now = parse_time(args.now) if args.now else datetime.now(timezone.utc)
        report = build_report(load_json(args.d1_json), load_json(args.r2_json), now, args.retention_days)
        rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
        if args.output:
            args.output.write_text(rendered, encoding="utf-8")
        else:
            sys.stdout.write(rendered)
    except (ValueError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
