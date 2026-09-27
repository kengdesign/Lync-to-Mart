# Lync to Mart — ขอบเขตและแผนทำต่อ

## เป้าหมาย

ร้านเล็กบน Thaimart สร้าง One-page โดยลดการกรอกข้อมูลซ้ำ ระบบเราช่วยนำเข้า/จัดระเบียบ/ตรวจทาน/นำเสนอ/วัดผล ส่วน checkout อยู่ที่ Thaimart รายได้หลักจาก subscription และบริการเสริม ไม่หักเปอร์เซ็นต์ยอดขายในโมเดลหลัก

URL เป้าหมาย: lyncto.link/mart และ lyncto.link/shop/{store}

## ลำดับการพัฒนา

### 1. Foundation — มีโค้ดในแพ็กนี้

ฐานข้อมูลร้าน/สินค้า/สิทธิ์แพ็กเกจ, UI จัดการร้าน, manual product, conditional JSON-LD import, draft review, One-page, upload media, outbound click statistics

เกณฑ์ผ่านรอบถัดไป: deploy staging ใน Cloudflare ของเจ้าของ + browser QA บน desktop/mobile + ทดสอบรูป R2 และ URL Thaimart จริง

### 2. เชื่อมระบบเดิมและนำเข้าข้อมูล

- ตรวจ repository และ architecture Lyncto/WordPress ปัจจุบัน
- ตกลง identity contract และวิธีล็อกอินร่วม ไม่สร้างบัญชีซ้ำถ้าไม่จำเป็น
- ส่ง URL สินค้า Thaimart จริงและเอกสาร API/permission หากมี
- เขียน adapter ต่อแหล่งข้อมูลจริง พร้อม idempotent import, source provenance, refresh diff และ retry
- รูปย้ายเข้า R2 เฉพาะเมื่อมีสิทธิ์ และใช้ image processing/size validation
- เก็บราคาที่ไม่ทราบเป็น null; ไม่ตีความสกุลเงินอื่นเป็น THB

### 3. AI และ UX ร้านค้า

- AI ใช้ source facts เท่านั้น ไม่สร้างยอดขาย best-seller สต็อก หรือคำกล่าวอ้างสินค้าเอง
- AI เสนอ description/highlights/FAQ/caption/หมวดหมู่ แล้วเจ้าของร้านอนุมัติ
- จัดวาง One-page, theme/color, gallery, share card, QR และ SEO metadata/schema
- queue jobs, cost metering, credit ledger และ quota แยก generation/import
- ไม่เรียก AI หรือนำเข้าข้อมูลใหม่ทุกครั้งที่ visitor เปิดหน้าร้าน

### 4. รายได้

ราคาเป็นข้อเสนอ ยังไม่ใช่ระบบขายที่เปิดใช้:

| แพ็กเกจ | ต่อเดือน | ต่อปี | ร้าน | สินค้ารวม | Branding |
|---|---:|---:|---:|---:|---|
| Free | 0 | 0 | 1 | 10 | มี |
| Starter | 199 | 1,990 | 1 | 30 | ซ่อนได้ |
| Growth | 499 | 4,990 | 1 | 100 | ซ่อนได้ |
| Brand | 990 | 9,900 | 3 | 500 | ซ่อนได้ |
| Enterprise | เสนอราคา | เสนอราคา | ตกลง | ตกลง | White label ตามขอบเขต |

สกุลเงิน THB; ต้องยืนยันภาษี/ใบกำกับ/หัก ณ ที่จ่ายกับ workflow ของ Lyncto ก่อนเปิดขาย

เพิ่ม Stripe Checkout/Customer Portal, signed webhooks + event deduplication, subscription states/grace/downgrade policy และ server-side entitlements ห้ามให้ frontend เปลี่ยน plan เอง

Analytics retention, storage quota, AI credits และทีมจากตารางที่เคยเสนอ ยังไม่ใช่ฟีเจอร์ที่พร้อมใช้ ต้องผูกสิทธิ์แบบ feature + quota ก่อนเปิดขาย

### 5. การเติบโต

Lync to LINE albums, Lyncto QR/campaign links, creator tracking, promotion scheduling, bulk CSV, team roles, admin console, custom domain และ Enterprise/API

Conversion/revenue/affiliate commission จะรายงานได้เมื่อมีข้อมูล order ที่ตรวจสอบได้จาก Thaimart เท่านั้น outbound click ไม่เท่ากับคำสั่งซื้อ

## ข้อมูลที่ยังต้องได้จากเจ้าของโปรเจกต์

1. ใช้ repository แยก https://github.com/kengdesign/Lync-to-Mart แล้ว; ยังต้องตรวจโค้ด/วิธีเชื่อมบัญชี Lyncto เดิมเมื่อเริ่ม SSO
2. ช่องทางเข้าถึง Cloudflare สำหรับ staging ผ่านการเชื่อมต่อที่รองรับหรือ terminal login
3. ได้ URL สินค้า Thaimart จริงครบ 3 ลิงก์แล้ว ดู docs/THAIMART-INTEGRATION.md; ยังรอทดสอบ extraction บน staging และเอกสาร integration ถ้ามี

## คำสั่งสำหรับ Codex รอบต่อไป

อ่าน README.md, docs/VERIFICATION.md และ docs/ROADMAP.md ในโปรเจกต์นี้ก่อน ทำงานต่อจากโค้ดเดิม เชื่อม staging Cloudflare ของเจ้าของเมื่อมีสิทธิ์และข้อมูลบัญชีครบ ห้ามอ้างว่าส่วน AI, payments หรือ sync ใช้ได้ถ้ายังไม่ได้เชื่อมจริง ทดสอบ flow ร้านค้าและ tenant isolation, ยืนยัน desktop/mobile จาก browser, รายงานภาษาไทย ระบุสิ่งที่ทำแล้วและสิ่งที่ต้องเชื่อมเพิ่มให้ชัดเจน

## สถานะอัปเดต 26 กันยายน 2026

เสร็จแล้วบน staging: นำเข้า Thaimart 3 ลิงก์จริง, rich text/รูป/ตัวเลือก, แทรก YouTube/MP4, ปรับ typography แดชบอร์ด

รอบจัดหน้าร้าน: โลโก้และภาพปก, SEO title/description + OG image, ค้นหาและกรองหมวดหมู่ใน One-page, หน้า /preview/{shopId} สำหรับเจ้าของเท่านั้น (รวม draft, noindex, ไม่บันทึก analytics และไม่มี redirect ซื้อจริง)

Migration 0003 เพิ่มคอลัมน์ร้านเท่านั้น ไม่เปลี่ยน slug หรือสถานะเปิดร้านเดิม; รูปแบรนด์เปิดสาธารณะเมื่อร้านเผยแพร่ รูปที่นำออกยังไม่ลบ R2 ถาวร

งานถัดไปที่ยังไม่เปิดใช้: QR/share assets, import provenance และตรวจรายการซ้ำ/ความต่างก่อนอัปเดต, SSO Lyncto, AI fact-based, ระบบสมาชิกและชำระเงิน ทั้งนี้รายละเอียด extraction เก่าในแผนด้านบนให้ยึดสถานะล่าสุดใน THAIMART-INTEGRATION.md

ภาพปก: เลื่อนจุดโฟกัสแนวตั้งได้ด้วย pointer drag และ range keyboard, กลับกึ่งกลาง, บันทึก cover_position_y 0–100 ค่าเริ่มต้น 50 ผ่าน migration 0004; กรอบ 3:1 ตรงกันทั้ง editor/preview/public โดยไม่เปลี่ยนต้นฉบับ (OG image ยังเป็นไฟล์ต้นฉบับ)

รอบแชร์หน้าร้าน: QR Code ลิงก์ตรง /shop/{slug}, ดาวน์โหลด PNG/SVG, native share และ clipboard fallback; สร้างในระบบ ไม่ใช้บริการ QR ภายนอก ไม่บันทึก events ขณะสร้าง QR และไม่แยกยอดสแกนออกจาก page view ยังไม่ใช่ Lyncto dynamic QR เมื่อย้ายโดเมนต้องสร้างใหม่

ลิงก์ซื้อ: migration 0005 แยก checkout_url จาก source_url; ช่องไม่บังคับและเว้นว่างใช้ source_url เดิม, อ่านข้อมูลใหม่เก็บ checkout_url ในฟอร์มไว้, API เก่าที่ไม่ส่งช่องนี้เก็บค่าเดิมไว้, /go เลือกลิงก์ซื้อก่อนและตรวจ allowlist ทุกครั้ง ไม่มีการเติมรหัส Affiliate หรือรับรอง attribution/commission จนกว่าจะมีเอกสารและลิงก์จริงจาก Thaimart

### Product click analytics (staging)
- Overview ranks products by outbound Thaimart clicks with 7/30-day selection, inclusive of today in Asia/Bangkok.
- Owner-only API; existing zero-click products and historical deleted-product counts retained. Counts include repeat clicks and may include bots; they do not represent sales, customers or commission.
- Covered date boundaries, tenant isolation and deleted products in integration tests. No schema migration required.

### Duplicate ThaiMart products (staging)
- Import, rescan and save preflight detect the same ThaiMart product ID within a shop, ignoring share/tracking query strings and fragments. Seller can open the existing draft/published item without automatic overwrite.
- Server-side atomic INSERT/UPDATE guards also prevent simultaneous duplicate saves. Different shops may carry the same product; existing data is not deleted or merged.
- Integration coverage includes URL variants, self-edit, cross-owner isolation, tracking URL preservation, concurrent creation and re-adding deleted products. No migration required.

### Account usage and package visibility (staging)
- Package page displays authenticated account totals for shops, all products (draft + published), and stored image/video bytes, with remaining quota, 80% warning state, full state and manual refresh.
- Per-store product breakdown and empty/error states. API derives limits from the current plan; media usage and upload enforcement share the same 500 MB constant.
- Stored files include unused uploads; removing images/products does not reclaim storage automatically. Billing/pricing remains a staging proposal; no payments or plan-changing API added.
- Integration tests cover empty accounts, multiple stores, owner isolation, actual media totals and changed plan limits.

### Paginated one-page storefront (staging)
- Twelve server-rendered products per page, crawlable previous/next/page links, self-canonical page URLs and page-specific structured data. Search matches name/description/category across all published shop products; filtered searches are noindex. Preview remains owner-only and noindex.
- Progressive navigation replaces only the catalog, retains shop branding above, supports history/back, aborts stale search requests and falls back to real links/forms without JavaScript.
- Compact responsive 4/3/2/1-column cards, one cover image, complete extra images/details and variants available on expansion. No source content removed.
- Integration tests cover 25 products over three pages, whole-shop search, canonical/schema, empty results, invalid pages and preview authorization.

### Imported product confirmation gate
- Fresh imports and rescans require confirming a draft save before publishing. Publish/draft shortcuts and the status selector stay locked until media copies and save complete.
- All editor controls lock during upload/save; saved imports reopen from the owner-only product API with a ready-to-publish notice.
- Failed media imports remain unpublishable and can retry, preserving completed copies and variant associations. Server rejects unresolved gallery/variant image URLs.
- DOM integration test covers blocked publish, in-flight locks, partial failure, retry and draft-to-published flow; API test covers incomplete media and owner-only readback.

### Featured products
- Owner can pin/unpin a product from the product list. Featured products sort first in the public catalog, search results and preview; pinned drafts stay private until published.
- Storefront badge says seller-recommended, not best-selling. Product edit preserves the flag; price, media and checkout URL are unaffected.
- Migration 0006 adds a default-off flag and catalog index. Integration test checks paging, tenant isolation, draft privacy, edits and unpinning.

### Bulk saved-product status (staging)
- Select up to 100 saved products, confirm publish/draft changes; owner-scoped atomic status update with full product validation before publication. Imported unsaved forms cannot enter this flow.
- Tests cover selection limits, confirmation, request locks/retry, tenant isolation, missing rows, incomplete media and draft-shop privacy.

### Review before rescan replacement (staging)
- Reading a product link inside the editor displays current unsaved form data versus freshly extracted ThaiMart data: name, price, category, description text/media counts, variants and gallery thumbnails.
- Keep current data cancels replacement without discarding edits. Apply replaces source fields in the form, preserves checkout URL and requires the existing draft confirmation/media-import flow before publication.
- Review does not write product records or copy media; it fetches source data and displays image previews. No background synchronization or persisted provenance history yet. Description comparison is textual, not a visual rich-content diff.
- DOM integration coverage verifies cancel, apply, retained checkout URL, escaped content and publication gate. Local suite now has 25 passing tests; mobile stacking is implemented but real-device visual QA remains pending.

### Base SKU import correction
- ThaiMart may encode a single-option product as one inventory variant with no attributes. Import now treats that row as the base product, returning no buyer variants while retaining gallery images and the top-level price (falling back to the row price when absent).
- SKU/weight/dimensions from that base row appear in the import review notes for manual checking; they are not added to the seller's description automatically. Genuine attribute-based options remain even when only one option exists. Ambiguous multiple or incomplete attribute rows fail with a clear error instead of inventing choices.
- Confirmed against public HTML of product 6a572a199c8506495ec55277: THB 59, seven gallery images, zero buyer options. Existing saved products are not automatically rewritten; re-read and review in the editor to update them. Regression suite: 26 passing tests.

### Dashboard product pagination
- Owner product management displays 20 rows by default, with 50/100 choices, previous/next and direct page selection. Search and status filtering still cover the entire loaded shop catalog, preserving featured order.
- Selection is explicitly limited to the visible page; changing page/filter/size rebuilds and clears selection. Bulk updates clamp the page when filtered results shrink.
- This reduces rendered dashboard rows; the owner API still returns all shop products. Public storefront pagination/SEO is unchanged. Responsive controls implemented; real-device visual QA remains pending.
- Tests cover 105 products, final pages, full-catalog search, filtered counts, empty results, boundary controls and direct page selection. Suite: 28 passing tests.

### Product click CSV export
- Overview analytics exports the currently displayed 7/30-day report with shop/product IDs, dates, Bangkok timezone, names, current statuses, counts and a raw-click disclosure. Includes zero-click products and deleted historical rows returned by the owner-scoped API.
- UTF-8 BOM, quoted multiline cells and formula-leading text escaping support spreadsheet use. Download stays disabled during loading, failures and empty reports; stale responses cannot replace the selected report.
- No additional API, collection, billing or sales attribution. Tests cover CSV formatting/formula safety and UI loading/race/retry behavior; suite: 30 passing tests.

### Referenced Shopee image host and empty-gallery publishing UX
- Product 6aa8a98ed792ee0753ff3dba references four public cf.shopee.co.th image URLs in ThaiMart's product data. Added that exact HTTPS hostname to the shared media allowlist, editor sanitizer and CSP; no wildcard, credentials, custom ports or redirect following allowed.
- Verified extraction yields four images/24 options and downloaded the actual cover as JPEG. Upload size/signature/ownership checks remain in place.
- Editor disables publish and published-status option when gallery is empty, permits draft saves and gives accurate zero-image feedback. Bulk publication rejects records without a cover. Existing saved content is not automatically reimported or unpublished.
- This UI gate does not change the legacy direct product API's allowance for image-free products. Existing test fixtures reflect gallery requirements in the editor and bulk UI.

### Product trash and restore
- Migration 0007 creates a separate owner/shop-scoped trash snapshot table. Normal delete now atomically snapshots the current product row and removes it from active products; public catalog, buy redirect, preview and product quota stop including it. Existing analytics remain historical.
- Product list opens Trash, with confirmed restore-as-draft and permanent snapshot deletion. Restore preserves original ID/content/media/variants/checkout/featured flag, atomically checks account quota and normalized ThaiMart duplicate identity, then removes the snapshot. Failed restore retains the trash entry.
- Archived items do not block adding the same link anew; restoring afterwards is blocked while the new active duplicate exists. Media remains stored, private unless separately referenced publicly, and counts toward storage; permanent snapshot deletion does not delete shared R2 files. No auto-expiry yet. Earlier hard-deleted items cannot be recovered by this feature.
- API/DOM tests cover active/public/media invisibility, owner isolation, duplicate reimport/restore, quota failure, field preservation, draft restore, permanent deletion and request locks. Suite: 35 passing tests.

### Saved shop readiness report
- Overview now checks saved product cover keys, plain-text descriptions, category and price (including every variant; zero is valid). Includes drafts and published products for the current shop, with per-issue filtering, ten-row pages and direct editor actions. It never mutates content or publication state.
- Store reminders use description/SEO-description fallback, cover/logo availability, store publication and published product presence. Empty catalogs offer Add Product.
- This is a field-completeness aid, not a broken-image/link checker, content-accuracy audit or SEO/AI ranking score. Unknown prices remain allowed. No external requests, new API, schema or service added.
- Logic/DOM tests cover missing data, zero/variant prices, image-only descriptions, whole-catalog filters, pagination, escaped names and edit/settings/empty-state actions. All 37 tests pass; responsive CSS implemented, real-device visual QA remains pending.

### Last confirmed import provenance
- Migration 0008 adds a saved provenance field and owner-scoped import receipts. Successful extraction issues a server-timestamped receipt; confirming a product save resolves that receipt into the original source URL and read time in the same product write. Clients cannot supply arbitrary provenance timestamps.
- Editor shows the last confirmed source/read time in Asia/Bangkok. It remains distinct from checkout/affiliate URL, is preserved by ordinary edits and trash/restore, and is cleared if the product source identity changes without a matching new import. Cancelled rescans do not change the saved provenance.
- Receipts are reusable for retry for seven days; expired receipts are rejected and cleaned for that owner on their next successful import. This is the latest confirmed import reference, not a full audit/content history or evidence that later seller edits match the source. No background refresh or price/stock sync.
- Older saved products retain an empty field until a new import is confirmed; older trash snapshots restore with an empty default. API, editor and DOM tests cover successful import issuance, no premature product save, owner/source/expiry validation, read-time persistence, retry/publish handoff, legacy trash and safe Thai-time display. Suite: 39 passing tests.

### Selective rescan review
- Existing-product rescan review now offers four independently selectable groups: name, category, rich description, and commerce (price + variants + gallery). Commerce stays together to preserve variant image associations. All groups start selected for compatibility; deselecting all disables Apply.
- Unselected fields retain the current unsaved form values, including seller-added inline images/videos and gallery/variant edits. Apply still requires confirmed draft save/media import before publishing and retains the checkout link; Cancel leaves the original form intact.
- Last confirmed import provenance records the source/read event even for partial selection; it is not a claim that every saved field matches the source. No new migration or external service.
- Added pure-merge and DOM tests for selective preservation, coupled commerce data, empty-selection guard and cancellation. Existing full editor confirmation tests still pass; suite: 41 tests. Responsive checkbox layout implemented; real-device visual QA pending.

### Unsaved product editor protection
- Product editor compares current field values, rich HTML and gallery with its opening/saved state when the seller closes the form. Close and Escape ask before discarding changes; unchanged/reverted forms close normally. Imported, unconfirmed content counts as unsaved immediately.
- Reload/navigation uses the browser's native beforeunload prompt while edits or requests are pending. Browsers control whether/how this prompt appears, especially on mobile; this is not autosave or crash recovery.
- In-flight operations still block closing; successful save/delete and editor replacement clean up the listeners. Existing duplicate replacement has its own confirmation. Shop settings and the initial link-entry dialog are outside this product-form guard.
- Guard and full editor DOM tests cover rich-text/gallery changes, cancellation/discard, pending imports, reverting, successful saves and listener cleanup. Suite: 44 passing tests; real-browser/device prompt behavior remains to be verified.

### Unsaved store settings protection
- Store settings now guard menu switches, shop selection, Create Another Shop and logout when named settings have changed. Includes hidden media keys/cover position, SEO, contact and publication fields. Cancelled shop changes restore the current picker value; selecting the already-active menu keeps the form.
- Upload/save operations block navigation with a notice. Save temporarily makes the form inert and blocks concurrent upload/delete/save handlers; a failed save retains edits and restores interaction. Successful save resets the baseline and normal rendering removes the old listener.
- Native beforeunload warning covers dirty/busy connected forms; browser-specific limitations remain and there is no autosave. Preview links open another tab without discarding the current form.
- DOM coverage checks each field category, revert/save, discard/cancel, busy navigation and listener cleanup. Suite: 45 passing tests; live-device visual and native-prompt QA remains pending.

### Dashboard catalog search and category filters
- Product management searches saved name, plain-text description, category, variant SKU and attribute names/values across the entire loaded shop catalog, before pagination. Search is case-insensitive; status and exact category filters combine with it.
- Category choices show whole-shop counts, include uncategorized products and preserve literal names safely. Clear Filters resets search/category/status while keeping the selected page size. Rows display their category.
- Filter changes reset to page one and reuse the existing page-scoped bulk selection reset. Responsive grid controls share a 48px height; public storefront, API and SEO behavior are unchanged.
- Tests cover a last-page SKU, seller descriptions, attributes, combined status/category conditions, uncategorized items, empty results, counts and escaped category labels. Suite: 47 passing tests; real-device visual QA pending.

### Bulk category management
- Selected dashboard products can be assigned an existing or new category, or have category removed with a separate explicit action. Every action confirms the number selected; the existing 100-item, visible-page selection rules apply.
- Owner-scoped POST bulk-category validates IDs/category and uses a count-guarded atomic update. Missing/foreign-shop IDs reject the entire request. Only category and updated_at change; status, content, media and checkout links remain intact.
- Pending requests lock category/status/selection controls; failures retain selection and input for retry. On success, category choices/counts refresh and the filter switches to the assigned category (or uncategorized), with page one selected.
- API and DOM coverage checks input limits, all-or-none behavior, owner isolation, preservation, confirmation, locking/retry and explicit clear. Suite: 49 tests pass. No schema migration; real-device visual QA pending.

### Bulk category cancellation fix
- Fixed a stuck-panel state: clearing all product selections disabled the category toggle but left its panel visible. The panel now hides whenever selection reaches zero; Cancel Selection also clears the pending category input.
- Added a dedicated Cancel button and Escape handling inside the category panel. Cancelling closes the panel, resets its inputs, preserves product selection and returns focus to the category toggle without an API write. Reopening remains available. In-flight write locks are unchanged.
- Regression covers direct cancel, clearing selection, deselecting all, reopening and Escape. Suite: 50 tests pass. User's video attachment was unavailable; this fixes the reproduced code path, not a claim that every reported symptom was observed.

### Product catalog CSV export
- Dashboard product list exports either the entire loaded active shop catalog or all matches of the current search/status/category filters, across pages. Includes drafts and published products; trash remains excluded. Scope/counts update with filters, and empty exports are disabled.
- One row per variant (one row for products without variants), with product/category/status, prices in THB, SKU/attributes, weight/dimensions, saved availability, source/checkout/effective links, gallery count and plain-text description. Long descriptions and links appear only on the first row per product to avoid repeating large content.
- UTF-8 BOM, quoted multiline cells and spreadsheet formula-prefix escaping. This is a data report, not a full backup/restore file: images/videos, rich formatting, live price/stock checks and CSV reimport are not included. Spreadsheet applications may auto-format identifiers such as numeric SKUs.
- CSV/DOM tests cover unknown/zero prices, variants, Thai text/quotes/newlines, formula prefixes, all filtered pages, scope retention and empty results. Suite: 52 tests pass; no backend/schema change. Real spreadsheet-app and device visual QA pending.

### Storefront themes and staging plan trial (2026-09-27)
- Store settings offers Classic Light (all plans), Midnight, Ocean and Sand (Starter/Growth/Brand). Shared responsive structure and server-rendered palette; one small CSS asset, no extra theme runtime or image/font dependencies.
- Migration 0009 stores an allowlisted theme. API enforces paid access and ownership. Omitted theme preserves saved value; downgrade renders Classic without deleting the paid selection. Search, pagination, product content and SEO output remain shared.
- Staging-only configured Brand entitlement for the owner of shop e635859a-7587-4568-b0c6-7a707f7e62fa, covering account quotas and branding as well as themes. Does not change users.plan_id or create billing. Production ignores override. Remove STAGING_TEST_PLAN/STAGING_TEST_SHOP_ID to end trial; handle quota reductions before moving to a real subscription.
- Validation: 53 automated tests pass, including all paid tiers, free rejection, tenant isolation, invalid input, persistence, downgrade, public SSR and production ignoring test entitlement. Physical tablet/mobile testing remains a user staging check.

### Try a theme before saving (2026-09-27)
- Store settings includes a private theme-preview link reflecting the selected radio, opened only on request in another tab (no automatic iframe/network traffic).
- Owner-only preview validates theme and plan, renders saved shop/product data with the requested palette without database writes. Search/category/page links retain preview theme; public URLs ignore theme overrides and canonical URLs exclude them.
- Automated coverage verifies preview isolation, ownership, invalid values, free-plan rejection, retained query and unchanged persisted/public theme. Device visual review remains a staging check.

### Plan entitlement clarity (2026-09-27)
- Plan cards now list theme access, import and QR sharing alongside account-wide shop/product limits. Paid tiers share the same four themes; Free has Classic Light.
- Usage API and account usage panel carry the staging-test flag, with an explicit no-charge, staging-only notice. Current plan card labels distinguish test entitlement from a subscription.
- Reuses existing requests and responsive plan cards; adds no assets or dependencies. Usage and theme entitlement regression tests pass.

### Storefront catalog sorting (2026-09-27)
- Visitors can choose shop recommendations (existing featured-first order), newest, or starting price ascending/descending. Sort applies after filters but before 12-item pagination; variant minimum price matches displayed starting prices, with missing prices last in either direction and zero treated as a valid price.
- Search, category links and pagination preserve sorting, including private theme preview. Server renders each sorted page and product schema; alternate sort URLs are noindex/follow in production, while staging remains noindex/nofollow.
- Responsive controls retain 48px height: four columns desktop, two tablet and stacked on narrow phones. No new dependencies or data requests added.
- Automated tests cover ordering across page boundaries, unknown prices, variants, query fallback, retained links and SSR metadata. Physical device visual testing remains a staging check.

### Active storefront filters (2026-09-27)
- Visible search/category chips let visitors remove one filter or clear both, retaining selected sort and private preview theme while returning to page one.
- Empty-results recovery now also preserves sorting. Controls are server-rendered links using existing catalog navigation, work without JavaScript, wrap on small screens and follow all theme palettes. No additional requests/dependencies.
- Catalog and theme regression checks include retained sort/theme, individual removal and no chips on an unfiltered page.

### Search discovery preparation (2026-09-27)
- Production robots.txt advertises sitemap.xml and excludes API, private preview and outbound tracking routes. Other environments disallow crawling and return 404 for sitemap endpoints.
- Sitemap index partitions published shops into groups of 100. Each sitemap lists each published shop's default catalog pages using the same 12-item page size and only published product counts; excludes filters, alternative sorts and drafts. No invented last-modified timestamps.
- Supports GET/HEAD; dynamic, uncached output reflects publication changes. No migrations, cron jobs, media loads or external services.
- Tested public/draft isolation, page counts, shard boundaries, HEAD and staging restrictions. Production hostname, Cloudflare bot rules and Search Console verification remain launch tasks; no indexing outcome is guaranteed.

### Account password change (2026-09-27)
- Account/security tab supports current/new/confirmation passwords, visibility toggle, password-manager autocomplete and navigation protection while saving.
- Authenticated same-origin endpoint verifies current password, enforces 12–128 characters and confirmation, and limits verification attempts to five per 15 minutes per account.
- Password update and revocation of every session for that user are atomic, guarded against concurrent password changes. Login session creation checks the password hash has not changed since verification. Other users are unaffected.
- Successful UI returns to sign-in and clears inputs. No real user passwords were changed during deployment verification. Email recovery remains a separate future step.
- Auth/tenant/rate-limit/session invalidation regression tests use local fixture accounts; deployment does not create new infrastructure.
