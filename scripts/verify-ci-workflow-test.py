#!/usr/bin/env python3
"""Regression tests for the CI workflow consistency checker."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("verify-ci-workflow.py")
SPEC = importlib.util.spec_from_file_location("verify_ci_workflow", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CiWorkflowConsistencyTests(unittest.TestCase):
    def test_required_commands_cover_python_and_node_checks(self) -> None:
        self.assertIn("python3 scripts/verify-sql.py", MODULE.REQUIRED_SCRIPT_COMMANDS)
        self.assertIn("python3 scripts/storage_tools_test.py", MODULE.REQUIRED_SCRIPT_COMMANDS)
        self.assertIn("npm run typecheck", MODULE.REQUIRED_NPM_COMMANDS)
        self.assertIn("npm run build", MODULE.REQUIRED_NPM_COMMANDS)

    def test_every_required_python_script_exists(self) -> None:
        for command in MODULE.REQUIRED_SCRIPT_COMMANDS:
            script = command.split("scripts/", 1)[1].split()[0]
            self.assertTrue((MODULE.ROOT / "scripts" / script).is_file(), script)

    def test_workflow_includes_all_required_commands(self) -> None:
        text = MODULE.WORKFLOW.read_text(encoding="utf-8")
        for command in MODULE.REQUIRED_SCRIPT_COMMANDS + MODULE.REQUIRED_NPM_COMMANDS:
            self.assertIn(command, text, command)

    def test_checker_does_not_claim_to_execute_node_checks(self) -> None:
        source = MODULE_PATH.read_text(encoding="utf-8")
        self.assertIn("does not execute the Node.js commands", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
