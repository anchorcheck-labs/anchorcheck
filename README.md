# AnchorCheck

Read-only diagnostics for Stellar anchor integrations. Catch discovery and response-shape mistakes before they become confusing wallet behavior.

Version 0.1.0. Implemented subset of SEP-24 v3.8.0; **not a full conformance suite or certification**. No deposits, withdrawals, authentication, or KYC requests are initiated.

## Quick start

Node.js 22 or later:

```sh
npm ci
npm test
npm run demo
```

The demo starts two ephemeral loopback servers: a valid local mock and a deliberately broken mock. It proves detection of wrong enabled types, reversed amount limits and missing CORS. These are simulated anchors, not Stellar Testnet deployments.

## Commands

```sh
node src/cli.js check https://anchor.example --output report.json
node src/cli.js info examples/info-valid.json
node src/cli.js transaction examples/transaction-valid.json
node src/cli.js discovery examples/stellar.toml
```

For the built-in local mock, use two terminals:

```sh
node src/cli.js mock 4180
node src/cli.js check http://127.0.0.1:4180 --allow-local
```

Supply a home origin to check; the tool reads /.well-known/stellar.toml, discovers TRANSFER_SERVER_SEP0024, and GETs its /info endpoint. URLs must use HTTPS, except explicitly enabled loopback demos. No bearer tokens are accepted. Results list error/warning severity, a stable finding code, path, and explanation.

Exit codes: 0 = no detected errors (warnings may remain); 1 = checks found errors; 2 = usage, input-file, or operational exception. JSON reports include the exact checked scope. A zero exit code is not proof of complete interoperability.

## Checks implemented

- TOML parsing, SEP-24 endpoint declaration, and HTTPS endpoint shape.
- Missing authentication discovery is a review warning; the tool recognizes SEP-10 and SEP-45 endpoint declarations but does not exercise either flow.
- Info asset enabled types; non-negative numeric fees and limits; min/max ordering; known boolean feature flags.
- Network /info JSON content type and required wildcard CORS response header.
- Captured transaction identity, kind, documented status, UTC timestamps, decimal amount formats, fee asset identifier prefix and exact breakdown sums.
- Withdrawal-only status applied to a deposit; deprecated amount_fee usage.

Different asset units are never incorrectly compared as a same-currency arithmetic equation. Lifecycle-dependent missing amount information is a warning rather than an invented universal requirement. Unknown extra response fields are tolerated.

## Limitations

No signature verification, SEP-10/45 token exchange, authenticated history requests, interactive flow, SEP-38 quotes, full refund schema, OPTIONS preflight, or end-to-end fund movement. Currencies and asset issuer checks remain limited. Public network reads do not verify an anchor's legal or business status.

The CLI bounds response size, redirects and timeouts and blocks obvious private network targets by default. It is not an SSRF-hardened hosted service; DNS rebinding is not prevented. Do not expose it as a server accepting arbitrary user URLs. Captured transaction files may contain personal data: use only sanitized fixtures.

## Library

```js
import { validateInfo, validateTransaction, report } from './src/index.js';
const result = report(validateInfo(yourCapturedInfo));
```

Source of requirements: [SEP-24](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md). Rules and deferred coverage are mapped in [docs/CHECKS.md](docs/CHECKS.md). Planned contributor issues: [docs/ISSUES.md](docs/ISSUES.md).

License: MIT. Maintainer attribution: JamesEjembi.

<!-- REFERENCE:START -->
## Public reference-anchor check

Checked at: 2026-11-08T18:16:17.672Z

Target: [https://testanchor.stellar.org](https://testanchor.stellar.org). Its discovery document declared Stellar Testnet. AnchorCheck performed only the discovery and /info GET requests; no deposits, withdrawals or authentication were initiated.

Result: 0 detected errors and 0 review warnings within the implemented subset.

Evidence: [latest.json](docs/reference/latest.json). This is a point-in-time interoperability diagnostic, not full SEP certification or a deployment of AnchorCheck to the blockchain.
<!-- REFERENCE:END -->
