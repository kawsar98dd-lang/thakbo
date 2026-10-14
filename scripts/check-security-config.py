#!/usr/bin/env python3
"""Read-only static security/configuration audit for THAKBO.

This checks repository configuration only. It does not inspect Cloudflare account state,
GitHub secret values, deployed Workers, or live D1/R2 resources.
"""
from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREVIEW_CHECKER = Path(__file__).with_name("check-preview-config.py")
_spec = importlib.util.spec_from_file_location("preview_config_checker", PREVIEW_CHECKER)
_preview = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_preview)

SECRET_KEY = re.compile(r"(secret|token|password|private.?key|api.?key|access.?key)", re.I)


def inspect_config(config: dict, gitignore: str, production_workflow: str, ci_workflow: str) -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []

    # Keep credentials out of committed plain-text Wrangler vars, including Preview vars.
    for scope in ("vars",):
        for key, value in (config.get(scope) or {}).items():
            if SECRET_KEY.search(str(key)) and value not in (None, ""):
                findings.append(("BLOCKER", f"wrangler.jsonc {scope}.{key} looks like a secret-bearing setting; move it to a platform secret."))
    previews = config.get("previews") or {}
    for key, value in (previews.get("vars") or {}).items():
        if SECRET_KEY.search(str(key)) and value not in (None, ""):
            findings.append(("BLOCKER", f"wrangler.jsonc previews.vars.{key} looks like a secret-bearing setting; move it to a platform secret."))

    # Reuse established Preview isolation checks so production and Preview cannot share D1/R2.
    for status, message in _preview.inspect(config):
        if status == "BLOCKER":
            findings.append(("BLOCKER", f"Preview isolation: {message}"))

    ignored_env = any(line.strip() in {".env", ".env.*", ".dev.vars", ".dev.vars.*"} for line in gitignore.splitlines())
    if not ignored_env:
        findings.append(("BLOCKER", ".gitignore must exclude .env, .env.*, .dev.vars and .dev.vars.*."))
    else:
        findings.append(("OK", "Local environment and dev-vars files are ignored by Git."))

    # Production D1 mutations must be manual-only and guarded by a confirmation string.
    trigger_block = production_workflow.split("permissions:", 1)[0]
    if "workflow_dispatch:" not in trigger_block or re.search(r"(?m)^\s*(push|pull_request|schedule):", trigger_block):
        findings.append(("BLOCKER", "Production D1 workflow must be manually triggered only (workflow_dispatch)."))
    elif '[ "$CONFIRM" != "THAKBO-DB" ]' not in production_workflow:
        findings.append(("BLOCKER", "Production D1 apply path is missing the THAKBO-DB confirmation guard."))
    elif "cancel-in-progress: false" not in production_workflow:
        findings.append(("WARNING", "Production D1 workflow should not cancel an in-progress migration."))
    else:
        findings.append(("OK", "Production D1 workflow is manual-only and includes an apply confirmation guard."))

    if "permissions:\n  contents: read" not in ci_workflow:
        findings.append(("WARNING", "CI workflow does not visibly declare least-privilege contents: read permissions."))
    else:
        findings.append(("OK", "CI workflow declares read-only repository permissions."))

    # A source-only scan cannot validate secret values, account access, or runtime behavior.
    findings.append(("MANUAL", "Verify GitHub CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID and Cloudflare BETTER_AUTH_SECRET in their secret stores; values are intentionally not read or printed."))
    findings.append(("MANUAL", "Confirm real production and Preview D1/R2 resources exist and are isolated in the Cloudflare dashboard."))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="exit non-zero if any BLOCKER is found")
    args = parser.parse_args()
    try:
        config = _preview.load_config()
        findings = inspect_config(
            config,
            (ROOT / ".gitignore").read_text(encoding="utf-8"),
            (ROOT / ".github/workflows/initialize-production-db.yml").read_text(encoding="utf-8"),
            (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8"),
        )
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    print("THAKBO repository security/configuration audit (read-only)")
    blockers = 0
    for status, message in findings:
        print(f"[{status}] {message}")
        blockers += status == "BLOCKER"
    print(f"\nBlockers: {blockers}")
    print("This report does not prove deployed/live configuration is correct.")
    return 1 if args.strict and blockers else 0


if __name__ == "__main__":
    raise SystemExit(main())
