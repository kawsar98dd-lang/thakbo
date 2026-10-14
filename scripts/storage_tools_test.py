#!/usr/bin/env python3
"""Offline regression tests for THAKBO's non-destructive R2 planning tools.

Run: python3 scripts/storage_tools_test.py
These tests use local fixtures only and never connect to Cloudflare or mutate storage.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"


def load_script(name: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, SCRIPTS / name)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


cleanup = load_script("r2-cleanup-plan.py", "thakbo_cleanup_plan")
queue_tool = load_script("r2-reconciliation-queue.py", "thakbo_reconciliation_queue")
diagnostics_tool = load_script("r2-storage-diagnostics.py", "thakbo_storage_diagnostics")
readiness_tool = load_script("r2-recovery-readiness.py", "thakbo_recovery_readiness")

LISTING = "123e4567-e89b-42d3-a456-426614174000"
IMAGE = "123e4567-e89b-42d3-a456-426614174001"
KEY = f"listings/{LISTING}/{IMAGE}.jpg"
NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)


class StorageToolsTests(unittest.TestCase):
    def test_cleanup_plan_excludes_referenced_recent_and_invalid_keys(self):
        recent_key = f"listings/{LISTING}/123e4567-e89b-42d3-a456-426614174002.webp"
        invalid_key = "../outside.jpg"
        d1 = {"object_keys": [KEY]}
        r2 = {"objects": [
            {"key": KEY, "uploaded_at": "2025-01-01T00:00:00Z"},
            {"key": recent_key, "uploaded_at": "2026-10-01T00:00:00Z"},
            {"key": invalid_key, "uploaded_at": "2025-01-01T00:00:00Z"},
            {"key": f"listings/{LISTING}/{IMAGE}.png", "uploaded_at": "2025-01-01T00:00:00Z"},
        ]}
        report = cleanup.build_report(d1, r2, NOW, 30)
        self.assertEqual(report["mode"], "DRY_RUN_ONLY_NO_DELETIONS")
        self.assertEqual(report["counts"]["candidate_count"], 1)
        self.assertEqual(report["candidates"][0]["key"], f"listings/{LISTING}/{IMAGE}.png")

    def test_cleanup_plan_rejects_invalid_retention_and_timestamp(self):
        with self.assertRaises(ValueError):
            cleanup.build_report({"object_keys": []}, {"objects": []}, NOW, 0)
        with self.assertRaises(ValueError):
            cleanup.parse_time("2025-01-01T00:00:00+00:00")

    def test_reconciliation_queue_is_deterministic_and_never_authorizes_delete(self):
        report = {"mode": cleanup.__dict__.get("EXPECTED_MODE", "DRY_RUN_ONLY_NO_DELETIONS"),
                  "generated_at": "2026-10-14T12:00:00Z", "retention_days": 30,
                  "candidates": [{"key": KEY, "uploaded_at": "2025-01-01T00:00:00Z"}]}
        first = queue_tool.build_queue(report)
        second = queue_tool.build_queue(report)
        self.assertEqual(first, second)
        self.assertFalse(first["automatic_deletions_enabled"])
        self.assertFalse(first["items"][0]["automatic_delete_allowed"])
        self.assertEqual(first["items"][0]["status"], "NEEDS_MANUAL_REVIEW")

    def test_reconciliation_queue_rejects_conflicting_duplicate_metadata(self):
        report = {"mode": "DRY_RUN_ONLY_NO_DELETIONS", "candidates": [
            {"key": KEY, "uploaded_at": "2025-01-01T00:00:00Z"},
            {"key": KEY, "uploaded_at": "2025-01-02T00:00:00Z"},
        ]}
        with self.assertRaises(ValueError):
            queue_tool.build_queue(report)

    def test_diagnostics_aggregates_events_without_leaking_raw_key_or_error(self):
        secret_key = "listings/private/secret-image.jpg"
        lines = [
            json.dumps({"message": "image upload to storage failed", "error": "sensitive stack trace"}),
            json.dumps({"message": "could not remove an unreferenced image file", "objectKey": secret_key}),
            "not-json",
        ]
        result = diagnostics_tool.summarize_lines(lines)
        rendered = json.dumps(result)
        self.assertEqual(result["recognized_event_counts"]["upload_storage_failed"], 1)
        self.assertEqual(result["unique_cleanup_object_fingerprint_count"], 1)
        self.assertNotIn(secret_key, rendered)
        self.assertNotIn("sensitive stack trace", rendered)
        self.assertEqual(result["malformed_line_count"], 1)

    def test_readiness_rejects_automatic_delete_or_bad_counts(self):
        diagnostics = {"mode": "LOCAL_LOG_SUMMARY_NO_CLOUD_ACTIONS", "recognized_event_counts": {
            "upload_storage_failed": 0, "image_row_save_failed": 0, "orphan_cleanup_failed": 0}}
        queue = {"mode": "REVIEW_QUEUE_ONLY_NO_STORAGE_ACTIONS", "item_count": 1, "items": [
            {"status": "NEEDS_MANUAL_REVIEW", "automatic_delete_allowed": True}]}
        with self.assertRaises(ValueError):
            readiness_tool.build_readiness(diagnostics, queue)
        queue["items"][0]["automatic_delete_allowed"] = False
        diagnostics["recognized_event_counts"]["upload_storage_failed"] = -1
        with self.assertRaises(ValueError):
            readiness_tool.build_readiness(diagnostics, queue)


if __name__ == "__main__":
    unittest.main(verbosity=2)
