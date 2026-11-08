# Validation — November 8, 2026

- Node.js 24.15.0: 12 tests passed.
- Valid local mock: zero findings. Deliberately broken mock: 3 errors and 1 warning, as expected.
- CLI valid info and transaction fixtures: exit 0. Broken info fixture: exit 1 with field-level diagnostics.
- Public testanchor.stellar.org discovery and /info check: zero errors and zero warnings for the implemented subset. Its discovery document declared Stellar Testnet. Report: docs/reference/latest.json.
- HTTPS checks include a synthetic browser Origin header. No authentication, KYC, deposit, withdrawal or fund transfer was performed.
- npm dependency audit at installation reported zero known vulnerabilities; this is not a security audit.
- Published to https://github.com/anchorcheck-labs/anchorcheck. GitHub Actions status is available in the repository Actions tab; local results above do not imply remote CI has passed.

Passing these checks does not certify complete SEP compliance or establish funding-program eligibility. See CHECKS.md for covered rules and deferred work.
