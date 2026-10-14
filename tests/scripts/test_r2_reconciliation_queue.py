import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "r2-reconciliation-queue.py"
SPEC = importlib.util.spec_from_file_location("r2_reconciliation_queue", SCRIPT)
queue_module = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(queue_module)


class R2ReconciliationQueueTests(unittest.TestCase):
    def setUp(self):
        self.key = "listings/123e4567-e89b-42d3-a456-426614174000/123e4567-e89b-42d3-a456-426614174001.jpg"
        self.report = {
            "mode": "DRY_RUN_ONLY_NO_DELETIONS",
            "generated_at": "2026-10-14T12:00:00Z",
            "retention_days": 30,
            "candidates": [{"key": self.key, "uploaded_at": "2026-08-01T00:00:00Z"}],
        }

    def test_queue_is_review_only_and_has_deterministic_id(self):
        first = queue_module.build_queue(self.report)
        second = queue_module.build_queue(self.report)
        self.assertEqual(first, second)
        self.assertEqual(first["mode"], "REVIEW_QUEUE_ONLY_NO_STORAGE_ACTIONS")
        self.assertFalse(first["automatic_retries_enabled"])
        self.assertFalse(first["automatic_deletions_enabled"])
        self.assertEqual(first["items"][0]["status"], "NEEDS_MANUAL_REVIEW")
        self.assertFalse(first["items"][0]["automatic_delete_allowed"])

    def test_duplicate_key_is_deduplicated(self):
        self.report["candidates"].append(dict(self.report["candidates"][0]))
        queue = queue_module.build_queue(self.report)
        self.assertEqual(queue["item_count"], 1)

    def test_rejects_wrong_mode_and_conflicting_duplicate(self):
        bad_mode = dict(self.report, mode="DELETE_NOW")
        with self.assertRaises(ValueError):
            queue_module.build_queue(bad_mode)
        self.report["candidates"].append({"key": self.key, "uploaded_at": "2026-01-01T00:00:00Z"})
        with self.assertRaises(ValueError):
            queue_module.build_queue(self.report)


if __name__ == "__main__":
    unittest.main()
