# Rule coverage

Baseline: SEP-24 v3.8.0, published specification. Findings check a subset, not an entire protocol implementation.

| Rules | Specification area | Current limit |
| --- | --- | --- |
| discovery.transfer / endpoint | Prerequisites, HTTPS Only | Endpoint format; no authentication handshake |
| discovery.auth | SEP-10 / SEP-45 prerequisites | Missing declaration is a warning; no signature validation |
| info.direction / enabled / number / range | Info response | Basic deposit/withdraw settings; no complete asset or issuer validation |
| info.boolean | Info fee/features | Known boolean flags only |
| http.content-type / cors | Content Type, Cross-Origin Headers | GET response only; no OPTIONS validation |
| transaction.kind / status / withdrawal-only | Transaction history shared fields and statuses | Snapshot checks; no state-transition graph |
| transaction.timestamp / time-order | Transaction timestamps | UTC format and calendar checks |
| transaction.amount | Decimal amount fields | String precision/positivity; no cross-asset conversion assumptions |
| transaction.fee-* | Fee details and breakdown | Exact breakdown sum; asset prefix only |

Deferred: SEP-10/45 authentication, SEP-38 quote checks, refunds, withdrawal memo policy, assets and signing key checks, browser interactive flow, compliance or business status. Do not interpret findings as a verdict on an anchor's legitimacy.
