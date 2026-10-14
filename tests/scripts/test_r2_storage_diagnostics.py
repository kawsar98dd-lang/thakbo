import importlib.util
import json
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "r2-storage-diagnostics.py"
SPEC = importlib.util.spec_from_file_location("r2_storage_diagnostics", SCRIPT)
module = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(module)


class R2StorageDiagnosticsTests(unittest.TestCase):
    def test_counts_known_events_and_fingerprints_cleanup_key(self):
        key = "listings/private-listing/photo-secret.jpg"
        lines = [
            json.dumps({"level": "error", "message": "image upload to storage failed", "error": {"message": "token=abc"}}),
            json.dumps({"level": "warn", "message": "could not remove an unreferenced image file", "objectKey": key, "error": "private details"}),
            json.dumps({"level": "warn", "message": "could not remove an unreferenced image file", "objectKey": key}),
            json.dumps({"level": "error", "message": "image row could not be saved"}),
        ]
        report = module.summarize_lines(lines)
        self.assertEqual(report["recognized_event_counts"]["upload_storage_failed"], 1)
        self.assertEqual(report["recognized_event_counts"]["image_row_save_failed"], 1)
        self.assertEqual(report["recognized_event_counts"]["orphan_cleanup_failed"], 2)
        self.assertEqual(report["unique_cleanup_object_fingerprint_count"], 1)
        self.assertNotIn(key, json.dumps(report))
        self.assertNotIn("private details", json.dumps(report))
        self.assertNotIn("token=abc", json.dumps(report))

    def test_malformed_and_unrecognized_lines_are_counted(self):
        report = module.summarize_lines(["not-json", json.dumps({"message": "unrelated event"}), "[]"])
        self.assertEqual(report["malformed_line_count"], 2)
        self.assertEqual(report["ignored_record_count"], 1)

    def test_oversized_line_is_skipped(self):
        report = module.summarize_lines(["x" * (module.MAX_LINE_BYTES + 1)])
        self.assertEqual(report["oversized_line_count"], 1)
        self.assertEqual(report["recognized_event_counts"]["orphan_cleanup_failed"], 0)


if __name__ == "__main__":
    unittest.main()
