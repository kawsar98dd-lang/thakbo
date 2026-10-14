#!/usr/bin/env python3
"""Create a non-destructive recovery checklist from storage diagnostics and review queue.

This tool does not connect to Cloudflare, retry operations, approve deletions, or mutate
D1/R2. It validates the input report modes and emits counts plus explicit operator gates.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

DIAGNOSTICS_MODE = "LOCAL_LOG_SUMMARY_NO_CLOUD_ACTIONS"
QUEUE_MODE = "REVIEW_QUEUE_ONLY_NO_STORAGE_ACTIONS"
REQUIRED_EVENT_COUNTS = {
    "upload_storage_failed",
    "image_row_save_failed",
    "orphan_cleanup_failed",
}


def build_readiness(diagnostics: dict[str, Any], queue: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(diagnostics, dict) or diagnostics.get("mode") != DIAGNOSTICS_MODE:
        raise ValueError(f"diagnostics mode must be {DIAGNOSTICS_MODE}")
    if not isinstance(queue, dict) or queue.get("mode") != QUEUE_MODE:
        raise ValueError(f"queue mode must be {QUEUE_MODE}")

    counts = diagnostics.get("recognized_event_counts")
    if not isinstance(counts, dict) or not REQUIRED_EVENT_COUNTS.issubset(counts):
        raise ValueError("diagnostics report is missing recognized event counts")
    normalized_counts: dict[str, int] = {}
    for name in sorted(REQUIRED_EVENT_COUNTS):
        value = counts[name]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f"event count {name} must be a non-negative integer")
        normalized_counts[name] = value

    items = queue.get("items")
    if not isinstance(items, list) or queue.get("item_count") != len(items):
        raise ValueError("queue items and item_count do not match")
    for item in items:
        if not isinstance(item, dict) or item.get("status") != "NEEDS_MANUAL_REVIEW":
            raise ValueError("every queue item must remain in NEEDS_MANUAL_REVIEW status")
        if item.get("automatic_delete_allowed") is not False:
            raise ValueError("automatic deletion must remain disabled for every queue item")

    return {
        "mode": "RECOVERY_READINESS_CHECKLIST_ONLY_NO_STORAGE_ACTIONS",
        "storage_event_counts": normalized_counts,
        "review_queue_item_count": len(items),
        "automatic_retries_enabled": False,
        "automatic_deletions_enabled": False,
        "readiness": "MANUAL_REVIEW_REQUIRED" if items or any(normalized_counts.values()) else "NO_REPORTED_ISSUES_IN_SUPPLIED_INPUTS",
        "operator_gates": [
            "Confirm the log export and inventory snapshots cover the same time window.",
            "Refresh the live D1 listing_images inventory immediately before any proposed action.",
            "Confirm each candidate still exists in R2 and is not referenced by any current row.",
            "Check application logs and recent listing activity for incomplete or delayed writes.",
            "Require a second-person review and explicit approval before a separate deletion operation.",
            "Record the outcome and preserve a rollback/recovery plan; never treat this report as approval.",
        ],
        "limitations": [
            "This report validates supplied files only; it does not query live D1 or R2.",
            "Absence of reported errors is not proof of storage consistency.",
            "Queue items remain manual-review-only; no retry or deletion action is available here.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--diagnostics", required=True, type=Path, help="Phase 32 diagnostics JSON")
    parser.add_argument("--queue", required=True, type=Path, help="Phase 31 review queue JSON")
    parser.add_argument("--output", type=Path, help="output JSON path (default: stdout)")
    args = parser.parse_args()
    try:
        diagnostics = json.loads(args.diagnostics.read_text(encoding="utf-8"))
        queue = json.loads(args.queue.read_text(encoding="utf-8"))
        result = build_readiness(diagnostics, queue)
        rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
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
