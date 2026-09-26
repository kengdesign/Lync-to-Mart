# Lync to Mart — 0.1.0 Foundation

เริ่มโครงการวันที่ 25 กันยายน 2026 — ภาษาไทยเป็นหลัก

Repository: https://github.com/kengdesign/Lync-to-Mart

GitHub Actions ตรวจ syntax และทดสอบทุก push/pull request ส่วน Cloudflare Workers Builds deploy staging จาก main

Staging: https://lync-to-mart-staging.paiboon.workers.dev/ — ยังไม่ใช่ production และไม่ได้เชื่อม DNS กับ lyncto.link

## สิ่งที่ทำแล้ว

- หน้าล็อกอินเจ้าของร้าน ด้วยบัญชีที่ผู้ดูแลสร้าง, password hash, session cookie HttpOnly, SameSite และ Secure บน HTTPS
- Dashboard ภาษาไทย, จัดการร้าน, รายการสินค้า ค้นหา/กรองสถานะ, เพิ่ม/แก้ไข/ลบ, อัปโหลด JPG/PNG/WebP
- แยก draft/published และเปิด/ปิดหน้าร้านได้
- หน้าร้าน server-rendered ที่ `/shop/{slug}` และปุ่มไปซื้อที่ Thaimart ผ่าน `/go/{productId}`
- โครง API + D1 schema + R2 binding สำหรับ Cloudflare Workers
- ตรวจ owner ใน API, โควตาร้าน/สินค้าจากตาราง plans และ branding ตาม plan
- นับ page views และ outbound clicks จริง ไม่อ้างว่าเป็นยอดขายหรือจำนวนคนไม่ซ้ำ
- นำเข้าข้อมูลจาก HTML สาธารณะของ Thaimart: ชื่อ ราคา รายละเอียด รูป และตัวเลือก แสดงให้ตรวจแก้ก่อนยืนยัน
- Rich text พร้อมรูปแทรก, แกลเลอรี, รูปตัวเลือก, SKU/ราคา/น้ำหนัก/ขนาดรายแบบ และ SSR Product structured data
- อ่านข้อมูลจริงโดยไม่ใช้ AI แต่งรายละเอียด ทดสอบกับ HTML ของลิงก์ตัวอย่าง 3 รายการ ดู docs/THAIMART-INTEGRATION.md
- หน้าแพ็กเกจแสดงข้อเสนอ Free / Starter / Growth / Brand โดยยังไม่เปิดขาย

## รันในเครื่อง

ต้องมี Node.js 24 ขึ้นไป:

```bash
npm ci
npm test
npm run check
npm run dev
```

เปิด `http://127.0.0.1:8787` บัญชีทดสอบและรหัสผ่านสุ่มจะอยู่ใน `.local/login.txt` ข้อมูลอยู่ใน `.local/mart.sqlite` และรูปใน `.local/media/` ห้ามอัปโหลดโฟลเดอร์นี้ไป production

โหมด local ใช้ `marketplace.example.test` เป็นโดเมนสมมติสำหรับทดสอบการบันทึกลิงก์ เช่น `https://marketplace.example.test/product/1` โดเมนนี้ไม่ใช่ Thaimart จริงและซื้อสินค้าไม่ได้

## โครงสร้าง

- `src/worker.mjs` API, auth, หน้าร้าน server rendering, redirect, media
- `src/security.mjs` password/hash/URL validation/HTML escape
- `src/import.mjs` Thaimart Flight และ JSON-LD extraction แบบไม่รันสคริปต์
- `src/content.mjs` rich HTML sanitizer และรูปแบบข้อมูลสินค้า
- `src/storefront.mjs` หน้าร้าน SSR และ structured data
- `public/` UI ภาษาไทยและ responsive CSS
- `migrations/0001_core.sql` schema, plans และ indexes
- `migrations/0002_product_content.sql` เพิ่มคอลัมน์เนื้อหา/แกลเลอรี/ตัวเลือก โดยไม่ลบข้อมูลเก่า
- `scripts/local.mjs` local HTTP server + SQLite/R2 adapter
- `scripts/create-user.mjs` สร้าง SQL สำหรับบัญชีทดสอบ staging
- `tests/core.test.mjs` ทดสอบ lifecycle/security/import/login limit
- `docs/CLOUDFLARE-SETUP.md` ขั้นตอนติดตั้ง staging ในบัญชีของคุณ
- `docs/ROADMAP.md` ขอบเขตที่ตกลงและงานที่ยังต้องทำ
- `docs/VERIFICATION.md` ผลการตรวจและข้อจำกัด

## ขอบเขตสำคัญ

ยังไม่มี: สมัครสมาชิกสาธารณะ, เชื่อมบัญชี Lyncto/WordPress, social login, กู้รหัสผ่าน, AI credits, AI generation, Stripe subscriptions/webhooks, VAT/WHT workflow, API sync Thaimart, QR generator, LINE album, creator/affiliate attribution, custom domains, admin console, backups/monitoring/retention jobs

ไม่มีการเก็บบัตรหรือรับเงิน ไม่มีการแก้ DNS หรือแตะ production และไม่มี secrets อยู่ในแพ็กนี้

หน้าจอมี responsive CSS แต่ยังไม่ได้ยืนยัน visual QA จริง: Cloud Browser ไม่สามารถเข้าถึง localhost ของ session นี้ได้ ต้องทดสอบ staging desktop/mobile ก่อนเปิดใช้
