# Managed domains — production cutover

## Implemented and guarded

- Fresh TXT proof claims canonical hostname globally; draft challenges do not reserve names.
- Per-account 1/2/5 quota for Starter/Growth/Brand (monthly/yearly use the same plan ID). Owner bypasses package quota, never provider cap.
- Single provider mutation lease; atomic capacity reservation before create. Default cap 90 (also check Cloudflare live usage/allocation). External/manual Cloudflare changes are outside the database lock.
- Unknown create outcomes retain name/capacity. Owner-only reconciliation supports matching original resource or two empty provider checks, with time gates and audit.
- Deletion confirmation precedes name/capacity release; failing deletion is retried.
- Draft and unconnected verified claim expire after 24 hours; pending connection after 7 days. Expired entitlement blocks serving immediately and retains the name for 7 days before remote removal. Paying paused domains remain reserved.
- Bounded cleanup (10 records per tick), every 15 minutes; paused/unknown states are not mistaken for deleted resources.
- Gateway rechecks entitlement and moderation on every request. Root storefront URL. No account/admin routes or session forwarding.
- UI gates actions by current state and shows DNS, grace warning and admin inventory.

## Current rollout state

Staging is enabled for owner role only. Existing pilot migrates on first owner domain-menu read without issuing a new hostname or removing the remote resource. Production configuration keeps MART_DOMAINS_ENABLED=false until cutover. Production registry is independent; do NOT run two environments as live hostname writers.

## Required access/configuration

1. Add encrypted secret MART_DOMAIN_API_TOKEN to lync-to-mart-production. Zone SSL and Certificates Edit, restricted to lynctomart.com. Never print or commit token. The staging secret is not automatically inherited.
2. Deploy production application with feature disabled, preserving all existing secrets and bindings; apply migrations including 0030 and 0031. Existing deployment command `npm run production:deploy` does both.
3. Before moving provider routing, disconnect the test hostname through the staging domain UI (or explicitly migrate it to a chosen production store after a separate verified data migration). Do not duplicate its remote registration across databases.
4. Set staging MART_DOMAINS_ENABLED=false AND DOMAIN_PREPARATION_ENABLED=false AND MART_PILOT_ENABLED=false in the relevant config/Worker. Gateway health should continue returning staging until cutover. Existing pilot endpoint must be disabled during freeze. Wait for in-flight provider lease window (120 seconds) to clear before activation.
5. Create production gateway from the same repo, deploy command `npx wrangler deploy --config wrangler.domain-gateway.production.jsonc`. This replaces the */* route ONLY in lynctomart.com with the production gateway. It binds production DB and production Mart Service. Never alter lyncto.link zone routes, DNS or fallback.
6. Verify health at shops.lynctomart.com/__mart_gateway_health returns environment production. Enable production MART_DOMAINS_ENABLED in source/config and deploy; add token first. Only now may production create hostnames.
7. Verify a real paid store: ownership, root-domain URL, SSL, resource isolation, pause/resume, disconnect/reclaim with new proof, quota and cleanup visibility. Main logintimate.com remains untouched; test only its dedicated thaimart subdomain.

## Rollback

Disable new creates before changing routing. Do not delete registry rows to roll back. Keep existing provider records for reconciliation. Restore application/gateway versions with compatible registry schema; an older pilot-only gateway cannot read migrated registry records. Do not switch back to the old preparation UI after migrating the pilot without restoring the pilot mapping deliberately.

## Root domains

CNAME flattening/ALIAS support is required for apex DNS. The UI supplies full hostname and explains @/blank provider conventions. Do not invent a universal A-record address or imply all DNS providers support apex CNAME. Domain purchase/renewal remains the merchant's responsibility.
