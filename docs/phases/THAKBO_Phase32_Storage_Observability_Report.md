# THAKBO Phase 32 — Storage Observability & Operational Diagnostics

## Scope
Add a local-only diagnostic tool for exported structured application logs. This phase does not change application runtime behavior, database schema, live D1, or R2 objects.

## Changes
- Added `scripts/r2-storage-diagnostics.py` to summarize the three existing image-storage failure messages: R2 upload failure, D1 image-row save failure, and failure to remove an unreferenced image object.
- The report contains aggregate counts and SHA-256 fingerprints for object keys linked to cleanup failures. It deliberately excludes raw keys, error messages, stack traces, request bodies, and headers.
- Malformed, oversized, and unrecognized records are counted rather than copied into the output.
- Added unit tests for aggregation, duplicate-key fingerprinting, sensitive-string omission, malformed records, and oversized-line handling.

## Usage
Export structured JSON-lines logs to a local file, then run:

```sh
python3 scripts/r2-storage-diagnostics.py --input exported-workers-logs.jsonl --output storage-diagnostics.json
```

Treat the input log export as sensitive and restrict access to it. The generated report is a diagnostic summary, not a deletion authorization.

## Safety limits
- The tool reads local files only; it does not connect to Cloudflare.
- It does not call D1/R2, retry operations, mutate queue state, or delete objects.
- A fingerprint only helps correlate events. Before remediation, re-check current D1 references and the actual R2 object.
- The existing logger serializes error messages and stacks. Operators should avoid putting credentials or personal data into thrown error text; this phase does not claim to fix every potential secret leak in runtime logs.

## Verification
- Python unit tests for this phase and prior Phase 29/31 scripts are run separately and reported in the handoff.
- Python syntax compilation, CLI help, and ZIP integrity are checked.
- Vitest, TypeScript, ESLint, application build, GitHub Actions CI, and live Cloudflare operations are not considered passed unless separately executed.
