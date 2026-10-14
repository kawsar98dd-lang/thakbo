#!/usr/bin/env python3
"""Convert an R2 dry-run report into a non-destructive reconciliation review queue.

This is a planning artifact only: it does not call Cloudflare, retry storage operations,
or delete objects. Queue IDs are deterministic for each object key so repeated runs are
idempotent at the planning layer. Every item requires a fresh D1 check and human review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

EXPECTED_MODE = "DRY_RUN_ONLY_NO_DELETIONS"


def build_queue(report: dict) -> dict:
    if not isinstance(report, dict) or report.get("mode") != EXPECTED_MODE:
        raise ValueError(f'input report mode must be {EXPECTED_MODE}')
    candidates = report.get("candidates")
    if not isinstance(candidates, list):
        raise ValueError('input report must contain "candidates": [...]')

    by_key: dict[str, dict] = {}
    for candidate in candidates:
        if not isinstance(candidate, dict):
            raise ValueError("every candidate must be an object")
        key = candidate.get("key")
        uploaded_at = candidate.get("uploaded_at")
        if not isinstance(key, str) or not key or not isinstance(uploaded_at, str) or not uploaded_at:
            raise ValueError("every candidate must contain non-empty string key and uploaded_at")
        # Same key can only appear once; reject conflicting metadata rather than guessing.
        if key in by_key and by_key[key] != candidate:
            raise ValueError(f"duplicate key has conflicting metadata: {key}")
        by_key[key] = {"key": key, "uploaded_at": uploaded_at}

    items = []
    for key in sorted(by_key):
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]
        items.append({
            "queue_id": f"r2-review-{digest}",
            "key": key,
            "uploaded_at": by_key[key]["uploaded_at"],
            "status": "NEEDS_MANUAL_REVIEW",
            "attempt_count": 0,
            "automatic_delete_allowed": False,
            "required_checks": [
                "Refresh D1 inventory and confirm no live listing_images row references this key.",
                "Confirm the R2 object still exists and its metadata matches the inventory.",
                "Review recent application logs for upload/delete failures involving this key.",
                "Obtain explicit operator approval before using a separate deletion workflow.",
            ],
        })
    return {
        "mode": "REVIEW_QUEUE_ONLY_NO_STORAGE_ACTIONS",
        "source_report_generated_at": report.get("generated_at"),
        "source_retention_days": report.get("retention_days"),
        "item_count": len(items),
        "automatic_retries_enabled": False,
        "automatic_deletions_enabled": False,
        "items": items,
        "limitations": [
            "This is not a durable queue and does not track operator decisions across runs.",
            "Deterministic IDs only provide idempotency in generated planning output.",
            "Do not delete based only on this file; re-check live D1 immediately before any action.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Phase 29 dry-run report JSON")
    parser.add_argument("--output", type=Path, help="output JSON path (default: stdout)")
    args = parser.parse_args()
    try:
        report = json.loads(args.input.read_text(encoding="utf-8"))
        queue = build_queue(report)
        rendered = json.dumps(queue, indent=2, sort_keys=True) + "\n"
        if args.output:
            args.output.write_text(rendered, encoding="utf-8")
        else:
            sys.stdout.write(rendered)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
