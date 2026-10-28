# Custom domains — controlled rollout

## Implemented preparation (disabled by default)
- Owner-only reservations, one hostname per shop, account-wide limits Starter 1 / Growth 2 / Brand 5. Both billing periods share limits. Mart owner role bypasses package limit.
- Atomic quota enforcement; TXT ownership check with a 60-second throttle and 5-second DNS timeout.
- No Cloudflare Custom Hostnames API calls, no traffic routing, no certificate provisioning. Verified means ownership only.
- Enable DOMAIN_PREPARATION_ENABLED=true only on staging to test. UI is staging-only. Production must remain disabled.

## Required Cloudflare configuration before activation
- Mandatory dedicated SaaS zone on a different domain. Shared-zone deployment under lyncto.link is prohibited. The user must select the unused domain before infrastructure provisioning.
- Enable Cloudflare for SaaS; configure a dedicated CNAME target and Workers fallback origin. Do not reuse WordPress or other application records.
- Zone ID and scoped Custom Hostnames API token (Worker secret); never put token in repository/chat.
- One customer-controlled test subdomain. Do not switch a live root domain during initial validation.

## Remaining implementation / release gates
- Persist provider hostname ID, lifecycle state, certificate status and retries; durable serialized global capacity reservation including in-flight requests. Set an explicit operator-approved hard cap after checking actual zone/account quota and existing usage; do not assume 100 free slots are available. Admin package exemption cannot bypass global cap.
- Provision only after TXT proof; recheck plan and ownership at provisioning. Recover ambiguous create responses via provider lookup before retry; no duplicate provisioning.
- Activate only when DNS target, hostname status and SSL status are all correct. Public custom-host routing must reject dashboard/API requests, isolate assets/media to the selected store, enforce account/shop suspension and set canonical/sitemap/redirect URLs correctly.
- Delete unactivated provider entries after 7 days with advance notice. Preserve active paid domains regardless of merchant login frequency.
- Cancellation retains service until paid entitlement ends. Proposed 7-day grace after entitlement loss; downgrade permits owner to choose retained domains. Notify before removal.
- Removal and replacement must delete provider resources; retry failed deletes with bounded backoff. Keep tombstones until confirmed removed. Replacement must respect cap during overlap.
- Scheduled bounded reconciliation and admin pending/active/deleting/error inventory, costs and global-cap controls. Alert on cleanup failures; stop new creates if reconciliation is stale or uncertain.
- Check hostname reassignment/takeover, expired entitlement, invalid SSL, provider outages, concurrent quota races, failed deletes and request caching before enabling production.
- Update paid package feature lists only after live end-to-end acceptance; do not advertise this preparation as working custom-domain hosting.

No provider resources have been created by this implementation.

## Isolation contract — resumed 2026-10-28
User has re-authorized development subject to all five isolation layers:
1. Separate SaaS zone. Never mutate lyncto.link DNS, routes, fallback origin or its existing custom hostnames.
2. Separate Mart custom-storefront gateway Worker and deployment configuration. Never edit lyncto-redirect-worker, securityheaders or html-edge-cache. Preserve existing mart.lyncto.link and line.lyncto.link bindings.
3. Dedicated token scoped to the new zone only. The runtime token must not have Worker script deployment privileges or write permissions on the existing zone. Setup/deployment credentials are separate from runtime provisioning credentials.
4. Lifecycle operations act only on provider resource IDs recorded as Mart-owned in the configured new zone. Fail closed on zone mismatch or ownership uncertainty. No account-wide deletion or adoption of unknown hostnames.
5. Dedicated staging hostname and rollback switch. Verify existing short-link and QR destinations before and after release; disabling the new gateway must preserve ordinary Mart shop URLs.

Before any infrastructure write, record the selected new zone/domain, dedicated gateway name, CNAME target and fallback, token permission scope, quota/cap, test hostname, and rollback steps. Stop if any proposed write targets the existing zone or Workers. An unused customer test subdomain and a dedicated provider zone are distinct requirements.

Production remains gated. Existing preparation does not implement gateway routing, provider provisioning or lifecycle cleanup. A separate zone may still share account-level quotas/billing; verify those before enabling creates.
