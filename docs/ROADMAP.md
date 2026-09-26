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
