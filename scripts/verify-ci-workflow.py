#!/usr/bin/env python3
"""Static consistency check: ensure CI workflow references available verification commands."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github/workflows/ci.yml"
REQUIRED_SCRIPT_COMMANDS = (
    "python3 scripts/verify-sql.py",
    "python3 scripts/check-preview-config.py",
    "python3 scripts/check-security-config.py --strict",
    "python3 scripts/check-security-config-test.py",
    "python3 scripts/production_db_test.py",
    "python3 scripts/check-preview-config-test.py",
    "python3 scripts/storage_tools_test.py",
)
REQUIRED_NPM_COMMANDS = (
    "npm run typecheck",
    "npm run lint",
    "npm test",
    "npm run build",
)


def main() -> int:
    if not WORKFLOW.is_file():
        print(f"ERROR: missing workflow: {WORKFLOW.relative_to(ROOT)}", file=sys.stderr)
        return 2
    text = WORKFLOW.read_text(encoding="utf-8")
    missing = [command for command in REQUIRED_SCRIPT_COMMANDS + REQUIRED_NPM_COMMANDS if command not in text]
    missing_files = [command.split("scripts/", 1)[1].split()[0] for command in REQUIRED_SCRIPT_COMMANDS if not (ROOT / "scripts" / command.split("scripts/", 1)[1].split()[0]).is_file()]
    if missing or missing_files:
        for command in missing:
            print(f"[BLOCKER] CI workflow is missing required command: {command}")
        for name in missing_files:
            print(f"[BLOCKER] CI command points to missing script: scripts/{name}")
        return 1
    print("CI workflow consistency check passed.")
    print(f"Verified {len(REQUIRED_SCRIPT_COMMANDS)} Python verification commands and {len(REQUIRED_NPM_COMMANDS)} Node.js quality commands.")
    print("This static check does not execute the Node.js commands or prove a GitHub Actions run is green.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
