import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "r2-recovery-readiness.py"
SPEC = importlib.util.spec_from_file_location("r2_recovery_readiness", SCRIPT)
module = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(module)


class R2RecoveryReadinessTests(unittest.TestCase):
    def setUp(self):
        self.diagnostics = {
            "mode": "LOCAL_LOG_SUMMARY_NO_CLOUD_ACTIONS",
            "recognized_event_counts": {
                "upload_storage_failed": 1,
                "image_row_save_failed": 2,
                "orphan_cleanup_failed": 1,
            },
        }
        self.queue = {
            "mode": "REVIEW_QUEUE_ONLY_NO_STORAGE_ACTIONS",
            "item_count": 1,
            "items": [{"status": "NEEDS_MANUAL_REVIEW", "automatic_delete_allowed": False}],
        }

    def test_produces_manual_review_checklist_without_actions(self):
        result = module.build_readiness(self.diagnostics, self.queue)
        self.assertEqual(result["readiness"], "MANUAL_REVIEW_REQUIRED")
        self.assertFalse(result["automatic_retries_enabled"])
        self.assertFalse(result["automatic_deletions_enabled"])
        self.assertEqual(result["review_queue_item_count"], 1)
        self.assertTrue(result["operator_gates"])

    def test_empty_inputs_do_not_claim_live_consistency(self):
        diagnostics = dict(self.diagnostics, recognized_event_counts={
            "upload_storage_failed": 0, "image_row_save_failed": 0, "orphan_cleanup_failed": 0
        })
        queue = dict(self.queue, item_count=0, items=[])
        result = module.build_readiness(diagnostics, queue)
        self.assertEqual(result["readiness"], "NO_REPORTED_ISSUES_IN_SUPPLIED_INPUTS")
        self.assertIn("Absence of reported errors is not proof of storage consistency.", result["limitations"])

    def test_rejects_wrong_modes_bad_counts_and_deletion_enabled(self):
        with self.assertRaises(ValueError):
            module.build_readiness(dict(self.diagnostics, mode="DELETE"), self.queue)
        bad_counts = dict(self.diagnostics, recognized_event_counts=dict(self.diagnostics["recognized_event_counts"], orphan_cleanup_failed=-1))
        with self.assertRaises(ValueError):
            module.build_readiness(bad_counts, self.queue)
        bad_queue = {**self.queue, "items": [{"status": "NEEDS_MANUAL_REVIEW", "automatic_delete_allowed": True}]}
        with self.assertRaises(ValueError):
            module.build_readiness(self.diagnostics, bad_queue)


if __name__ == "__main__":
    unittest.main()
