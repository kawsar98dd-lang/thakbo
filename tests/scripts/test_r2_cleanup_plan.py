import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "r2-cleanup-plan.py"
SPEC = importlib.util.spec_from_file_location("r2_cleanup_plan", SCRIPT)
planner = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(planner)


class R2CleanupPlanTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)
        self.old_key = "listings/123e4567-e89b-42d3-a456-426614174000/123e4567-e89b-42d3-a456-426614174001.jpg"
        self.referenced_key = "listings/123e4567-e89b-42d3-a456-426614174000/123e4567-e89b-42d3-a456-426614174002.webp"

    def test_only_old_unreferenced_valid_keys_are_candidates(self):
        report = planner.build_report(
            {"object_keys": [self.referenced_key]},
            {"objects": [
                {"key": self.old_key, "uploaded_at": "2026-08-01T00:00:00Z"},
                {"key": self.referenced_key, "uploaded_at": "2026-08-01T00:00:00Z"},
                {"key": self.old_key.replace(".jpg", ".svg"), "uploaded_at": "2026-08-01T00:00:00Z"},
                {"key": self.old_key.replace(".jpg", ".png"), "uploaded_at": "2026-10-01T00:00:00Z"},
            ]}, self.now, 30)
        self.assertEqual([x["key"] for x in report["candidates"]], [self.old_key])
        self.assertEqual(report["mode"], "DRY_RUN_ONLY_NO_DELETIONS")
        self.assertEqual(report["counts"]["referenced"], 1)
        self.assertEqual(report["counts"]["invalid_key"], 1)
        self.assertEqual(report["counts"]["too_recent"], 1)

    def test_rejects_bad_input_and_retention(self):
        with self.assertRaises(ValueError):
            planner.build_report({"object_keys": "not-list"}, {"objects": []}, self.now, 30)
        with self.assertRaises(ValueError):
            planner.build_report({"object_keys": []}, {"objects": []}, self.now, 0)

    def test_rejects_non_utc_timestamp(self):
        with self.assertRaises(ValueError):
            planner.build_report({"object_keys": []}, {"objects": [{"key": self.old_key, "uploaded_at": "2026-01-01T00:00:00+06:00"}]}, self.now, 30)


if __name__ == "__main__":
    unittest.main()
