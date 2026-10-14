#!/usr/bin/env python3
"""Offline tests for THAKBO's static security/configuration audit."""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("check-security-config.py")
spec = importlib.util.spec_from_file_location("security_config_check", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


class SecurityConfigTests(unittest.TestCase):
    def test_current_repository_has_no_blockers(self):
        config = module._preview.load_config()
        root = SCRIPT.parent.parent
        findings = module.inspect_config(
            config,
            (root / ".gitignore").read_text(),
            (root / ".github/workflows/initialize-production-db.yml").read_text(),
            (root / ".github/workflows/ci.yml").read_text(),
        )
        self.assertFalse([message for status, message in findings if status == "BLOCKER"])

    def test_secret_in_plain_vars_is_blocked(self):
        config = {
            "vars": {"APP_NAME": "THAKBO", "BETTER_AUTH_SECRET": "not-a-real-secret"},
            "d1_databases": [{"binding": "DB", "database_name": "prod", "database_id": "prod-id"}],
            "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "prod-media"}],
            "previews": {
                "vars": {"APP_NAME": "thakbo-preview"},
                "d1_databases": [{"binding": "DB", "database_name": "preview", "database_id": "preview-id"}],
                "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "preview-media"}],
            },
        }
        findings = module.inspect_config(config, ".env\n.env.*\n.dev.vars\n.dev.vars.*", 'workflow_dispatch:\nif [ "$CONFIRM" != "THAKBO-DB" ]', "permissions:\n  contents: read")
        self.assertTrue(any(status == "BLOCKER" and "BETTER_AUTH_SECRET" in message for status, message in findings))

    def test_shared_preview_r2_is_blocked(self):
        config = {
            "vars": {"APP_NAME": "THAKBO"},
            "d1_databases": [{"binding": "DB", "database_name": "prod", "database_id": "prod-id"}],
            "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "same"}],
            "previews": {
                "vars": {"APP_NAME": "thakbo-preview"},
                "d1_databases": [{"binding": "DB", "database_name": "preview", "database_id": "preview-id"}],
                "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "same"}],
            },
        }
        findings = module.inspect_config(config, ".env\n.env.*\n.dev.vars\n.dev.vars.*", 'workflow_dispatch:\nif [ "$CONFIRM" != "THAKBO-DB" ]', "permissions:\n  contents: read")
        self.assertTrue(any(status == "BLOCKER" and "R2" in message for status, message in findings))

    def test_missing_env_ignore_rules_is_blocked(self):
        config = {
            "vars": {"APP_NAME": "THAKBO"},
            "d1_databases": [{"binding": "DB", "database_name": "prod", "database_id": "prod-id"}],
            "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "prod-media"}],
            "previews": {
                "vars": {"APP_NAME": "thakbo-preview"},
                "d1_databases": [{"binding": "DB", "database_name": "preview", "database_id": "preview-id"}],
                "r2_buckets": [{"binding": "MEDIA_BUCKET", "bucket_name": "preview-media"}],
            },
        }
        findings = module.inspect_config(config, "node_modules/", 'workflow_dispatch:\nif [ "$CONFIRM" != "THAKBO-DB" ]', "permissions:\n  contents: read")
        self.assertTrue(any(status == "BLOCKER" and ".gitignore" in message for status, message in findings))


if __name__ == "__main__":
    unittest.main(verbosity=2)
