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
