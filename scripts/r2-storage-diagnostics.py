#!/usr/bin/env python3
"""Build a privacy-conscious summary from exported THAKBO JSON-lines logs.

This tool reads local exported logs only. It never calls Cloudflare or changes D1/R2.
It intentionally emits aggregate event counts and short SHA-256 fingerprints for object
keys associated with cleanup warnings; it never copies raw log messages, errors, stack
traces, request data, headers, or object keys into the report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

MAX_LINE_BYTES = 1_000_000
EVENTS = {
    "image upload to storage failed": "upload_storage_failed",
    "image row could not be saved": "image_row_save_failed",
    "could not remove an unreferenced image file": "orphan_cleanup_failed",
}


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def summarize_lines(lines: list[str]) -> dict[str, Any]:
    counts: Counter[str] = Counter()
    cleanup_keys: set[str] = set()
    malformed = 0
    oversized = 0
    ignored = 0

    for line in lines:
        if len(line.encode("utf-8", errors="replace")) > MAX_LINE_BYTES:
            oversized += 1
            continue
        try:
            record = json.loads(line)
        except (json.JSONDecodeError, TypeError):
            malformed += 1
            continue
        if not isinstance(record, dict):
            malformed += 1
            continue
        message = record.get("message")
        category = EVENTS.get(message) if isinstance(message, str) else None
        if category is None:
            ignored += 1
            continue
        counts[category] += 1
        if category == "orphan_cleanup_failed":
            key = record.get("objectKey")
            if isinstance(key, str) and key:
                cleanup_keys.add(fingerprint(key))

    return {
        "mode": "LOCAL_LOG_SUMMARY_NO_CLOUD_ACTIONS",
        "input_line_count": len(lines),
        "recognized_event_counts": {name: counts.get(name, 0) for name in EVENTS.values()},
        "unique_cleanup_object_fingerprints": sorted(cleanup_keys),
        "unique_cleanup_object_fingerprint_count": len(cleanup_keys),
        "malformed_line_count": malformed,
        "oversized_line_count": oversized,
        "ignored_record_count": ignored,
        "privacy_notes": [
            "Raw log messages, error messages, stack traces, object keys, request bodies and headers are not included.",
            "Object fingerprints help correlate repeat failures without revealing the original key.",
            "A fingerprint is an operational correlation aid, not proof that an object is safe to delete.",
        ],
        "required_follow_up": [
            "Use current D1 and R2 inventories to investigate cleanup failures.",
            "Do not delete objects based solely on this report or a log fingerprint.",
            "Restrict access to source logs because they may contain sensitive details.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="exported JSON-lines log file")
    parser.add_argument("--output", type=Path, help="write JSON report here (default: stdout)")
    args = parser.parse_args()
    try:
        with args.input.open("r", encoding="utf-8") as handle:
            report = summarize_lines(handle.readlines())
        rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
        if args.output:
            args.output.write_text(rendered, encoding="utf-8")
        else:
            sys.stdout.write(rendered)
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
