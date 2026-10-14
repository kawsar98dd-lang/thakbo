#!/usr/bin/env python3
"""Offline tests for the read-only Wrangler preview config checker."""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("check-preview-config.py")
spec = importlib.util.spec_from_file_location("preview_check", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


class PreviewConfigTests(unittest.TestCase):
    def test_jsonc_comments_are_removed_but_comment_text_in_strings_is_preserved(self):
        parsed = module.json.loads(module.remove_jsonc_comments('{\n // comment\n "url":"https://example.test/a//b", /* block */ "x": 1\n}'))
        self.assertEqual(parsed["url"], "https://example.test/a//b")
        self.assertEqual(parsed["x"], 1)

    def test_current_config_has_separate_preview_db_and_warns_about_optional_production_id(self):
        config = module.load_config()
        findings = module.inspect(config)
        blockers = [message for status, message in findings if status == "BLOCKER"]
        warnings = [message for status, message in findings if status == "WARNING"]
        self.assertFalse(any("Production D1" in message and "database_id" in message for message in blockers))
        self.assertFalse(any("Preview has no separate D1" in message for message in blockers))
        self.assertFalse(blockers)
        preview = config["previews"]["d1_databases"][0]
        self.assertEqual(preview["database_id"], "d6645494-9dfd-4916-9eec-a040b3404ef7")
        self.assertEqual(preview["database_name"], "thakbo-preview")
        self.assertTrue(any("Production D1" in message and "automatically provision" in message for message in warnings))

    def test_preview_cannot_share_production_database(self):
        config = {
            "d1_databases": [{"binding": "DB", "database_name": "thakbo-db", "database_id": "prod-id"}],
            "previews": {"d1_databases": [{"binding": "DB", "database_name": "thakbo-db-preview", "database_id": "prod-id"}], "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "preview"}], "vars": {"APP_NAME": "thakbo-preview"}},
        }
        messages = [message for status, message in module.inspect(config) if status == "BLOCKER"]
        self.assertTrue(any("matches production" in message for message in messages))

    def test_preview_cannot_share_production_r2_bucket(self):
        config = {
            "d1_databases": [{"binding": "DB", "database_name": "thakbo-db", "database_id": "prod-id"}],
            "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "shared-media"}],
            "previews": {
                "d1_databases": [{"binding": "DB", "database_name": "thakbo-db-preview", "database_id": "preview-id"}],
                "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "shared-media"}],
                "vars": {"APP_NAME": "thakbo-preview"},
            },
        }
        messages = [message for status, message in module.inspect(config) if status == "BLOCKER"]
        self.assertTrue(any("Preview MEDIA_BUCKET name matches production" in message for message in messages))

    def test_valid_separate_resources_have_no_blockers(self):
        config = {
            "d1_databases": [{"binding": "DB", "database_name": "thakbo-db", "database_id": "prod-id"}],
            "previews": {"d1_databases": [{"binding": "DB", "database_name": "thakbo-db-preview", "database_id": "preview-id"}], "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "thakbo-media-preview"}], "vars": {"APP_NAME": "thakbo-preview"}},
        }
        self.assertFalse([message for status, message in module.inspect(config) if status == "BLOCKER"])

    def test_same_preview_database_name_is_blocked_even_when_ids_are_unknown(self):
        config = {
            "d1_databases": [{"binding": "DB", "database_name": "thakbo-db"}],
            "previews": {"d1_databases": [{"binding": "DB", "database_name": "thakbo-db"}], "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "preview"}], "vars": {"APP_NAME": "thakbo-preview"}},
        }
        messages = [message for status, message in module.inspect(config) if status == "BLOCKER"]
        self.assertTrue(any("database_name matches production" in message for message in messages))

    def test_missing_production_id_is_not_a_blocker_when_preview_is_explicitly_isolated(self):
        config = {
            "d1_databases": [{"binding": "DB", "database_name": "thakbo-db"}],
            "previews": {"d1_databases": [{"binding": "DB", "database_name": "thakbo-db-preview", "database_id": "preview-id"}], "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "thakbo-media-preview"}], "vars": {"APP_NAME": "thakbo-preview"}},
        }
        findings = module.inspect(config)
        self.assertFalse([message for status, message in findings if status == "BLOCKER"])
        self.assertTrue([message for status, message in findings if status == "WARNING" and "Production D1" in message])


if __name__ == "__main__":
    unittest.main(verbosity=2)
