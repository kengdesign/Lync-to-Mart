# Dedicated Mart domain gateway — staging pilot

Status: code/configuration ready; a NEW Cloudflare Worker deployment is required.
No existing lyncto.link route, Worker, DNS record or fallback is changed.

## Create one new Worker from GitHub

Cloudflare Workers & Pages → Create application → Import a repository.
- Repository: kengdesign/Lync-to-Mart
- Branch: main
- Worker name: lync-to-mart-domain-gateway-staging
- Root directory: repository root (`/`)
- Build command: leave empty
- Deploy command: `npx wrangler deploy --config wrangler.domain-gateway.staging.jsonc`
- Preview/non-production branch deployments: disable for this pilot.

The dedicated configuration supplies the D1 binding and Mart staging Service binding.
It installs `*/*` ONLY inside zone f0b5797bfb2571e56c55b7dedd8fbcbc (lynctomart.com).
Do not create that route in lyncto.link or logintimate.com.
The gateway does not need MART_DOMAIN_API_TOKEN. Keep that secret on the existing Mart staging Worker.

## Verify and connect

1. Open https://shops.lynctomart.com/__mart_gateway_health . Expected JSON service mart-domain-gateway, environment staging, version 1.
2. In the Mart staging domain menu, click เตรียมโดเมนทดสอบ. This verifies the gateway, current TXT, fallback and quota, and reserves a durable single pilot slot before creating the Cloudflare hostname. It only accepts thaimart.logintimate.com.
3. In logintimate.com DNS, replace ONLY the existing A record named thaimart with CNAME → shops.lynctomart.com; DNS only; TTL Auto. Preserve the ownership TXT and all other records. Add any Cloudflare validation TXT shown by the pilot UI.
4. Click ตรวจสถานะ DNS / HTTPS. Only hostname active AND SSL active enable the pilot gateway.
5. Open https://thaimart.logintimate.com and check correct shop, images, campaigns, search, pagination, product links, stock/live feeds. Account/admin and another shop's URLs must fail closed.

## Pause and removal

Pause disables the local gateway but retains the hostname (still counts toward Cloudflare usage).
Disconnect disables the gateway, verifies the remote hostname ID/name and deletes the Cloudflare resource before releasing the slot.
Unknown create outcomes keep the slot reserved and prevent automatic retry; an operator must reconcile Cloudflare first.
The pilot creates at most one managed hostname and stops at the smaller of allocated quota and 100 used names. External changes in another zone/account can still change total billing; this is not a billing guarantee.
Deleting the preparation record is blocked while a pilot slot remains.

## Still not general availability

This is one staging hostname only. Production, arbitrary customer apex/subdomains, automatic abandoned-domain cleanup, general quotas, full reconnect/edit lifecycle and final end-to-end verification are not released by this change.
Root domains require suitable DNS flattening/ALIAS support or a separately supported apex solution; no universal A-record IP is supplied.
