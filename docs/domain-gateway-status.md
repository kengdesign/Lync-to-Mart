# Domain gateway status

The public boundary in src/domain-gateway.mjs is tested but not deployed or wired into the existing Worker. It deliberately requires injected domain resolution, resource authorization and a service binding. Do not bind it to live routes yet.

Before deployment implement:
- Persisted provider activation and HTTPS status; TXT verification alone must never activate a domain.
- resolveDomain using current paid entitlement, published shop status, account moderation, and owner overrides.
- authorizeResource for the selected shop's published products and publicly referenced media (including rich descriptions, variants and campaign limits).
- Shop-scoped stock and live APIs; currently all API paths are blocked, so live/stock badge requests will not work through this boundary yet.
- Explicit external product destination allowlist and outbound redirect review.
- Provider creation/deletion lifecycle, isolated API permissions, budget reconciliation and scheduled cleanup.
- Dedicated gateway deployment with Mart service binding; production remains unchanged.
- SEO canonical policy and root path presentation. Current boundary redirects root to the same host's /shop/{slug}.

Tests cover credential stripping, restricted routes, invalid domain states, cross-shop denial and redirect leakage. They are unit tests, not end-to-end proof of Cloudflare routing or TLS.
