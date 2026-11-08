# Proposed contributor issues

These are drafts, not published GitHub issues.

1. **Add sanitized transaction lifecycle fixtures.** Cover each documented SEP-24 status, separate universally required fields from lifecycle-dependent fields, and link each check to the specification. Acceptance: positive and negative fixtures, no invented requirements.
2. **Validate SEP-38 asset identifiers.** Parse supported identifier forms and check issuer/address format without equating asset code to asset identity. Acceptance: malformed examples fail; valid native, issued, fiat and contract examples remain distinguishable.
3. **Check OPTIONS responses.** Add opt-in CORS preflight diagnostics without initiating any transfer. Acceptance: broken mock OPTIONS behavior is detected and all methods are logged in tests.
4. **Extend refund validation.** Implement exact decimal refund totals against individual payment components. Acceptance: partial/full refunds and differing asset units are handled explicitly.
5. **Add machine-readable rule catalog.** Publish stable codes, source sections and remediation hints. Acceptance: documentation and implementation cannot drift unnoticed.
6. **Validate with an independent wallet maintainer.** Record reproducible usability feedback and implement one demonstrated integration improvement; do not fabricate adoption.
