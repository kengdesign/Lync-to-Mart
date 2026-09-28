# Mart billing preparation — 28 September 2026

Approved: advertised prices are THB gross amounts, VAT 7% inclusive. Do not add 7% to the existing plan prices.

| Plan | Monthly THB incl. VAT | Annual THB incl. VAT |
|---|---:|---:|
| Free | 0 | 0 |
| Starter | 199 | 1,990 |
| Growth | 499 | 4,990 |
| Brand | 990 | 9,900 |

User-provided Line example: total 119.00 = net 111.21 + VAT 7.79. Both uploaded Invoice and Receipt show the same split. Use the final annual amount for tax calculations, never the rounded monthly equivalent.

## Next integration

- Separate Mart Stripe sandbox, products, six recurring prices and webhook destination. Do not edit Line products, subscriptions, tax rates or portal settings.
- Gross amounts in integer satang match D1 plans. Configure inclusive tax behavior. A manually configured inclusive VAT rate has percentage 7 and inclusive=true; verify the actual sandbox tax configuration before creating Checkout.
- Alternative Stripe Tax automatic calculation requires checking tax registration and customer tax scope first; do not enable it blindly or combine it with manual tax rates.
- Hosted Checkout in subscription mode; Customer Portal for supported subscription management. Keep payment methods dynamically configured.
- Mandatory signed webhook handling with deduplication and current subscription reconciliation before updating paid access. A redirect to the success page never grants a plan.
- Owner promotional overrides remain independent from paid entitlement. Base billing plan must be updated by verified billing state only.
- Invoice/receipt links must be retrieved from Stripe for the authenticated customer's records. Do not manufacture document links or claim these are statutory Thai tax invoices without checking business document requirements.
- Requires sandbox connection/authentication, restricted runtime API key stored in Cloudflare Secrets and a separate webhook signing secret. No credentials in source or chat.

## Current status

Pricing labels and sandbox billing implementation are prepared. Checkout remains disabled until runtime configuration is supplied. The GPT Stripe connector is unavailable; the user can create isolated Mart sandbox resources directly in Stripe Dashboard using the Thai setup guide. No document download or real payment functionality is activated.

Reference: https://docs.stripe.com/billing/taxes/tax-rates

## Sandbox implementation update

Checkout, signed webhook reconciliation, renewal cancellation/resumption and a gated billing UI are implemented. See [Thai setup and test guide](STAGING-TEST-TH.md). API version pinned to documented `2025-09-30.clover`. Database migration 0017 is additive. No Stripe resources or runtime keys were created by this change; BILLING_ENABLED defaults off. Production explicitly blocked. Owner promotion precedence preserved, staging Brand fallback ends after first subscription. Local automated tests mock Stripe; real end-to-end testing remains blocked on sandbox configuration.
