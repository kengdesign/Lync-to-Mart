# สำรองและซ้อมกู้คืน Lync to Mart

สถานะ: มีเครื่องมือตรวจ SQL + ไฟล์สำรองและผ่านการซ้อมด้วยข้อมูลจำลองแล้ว **ยังไม่ได้สำรองข้อมูลจาก Cloudflare จริงหรือเปิดสำรองอัตโนมัติ** การทดสอบนี้ไม่รับรองการกู้คืน remote D1 หรือ metadata ของ R2 ครบทั้งหมด

## ขอบเขตของ Mart Staging เท่านั้น

- Worker: `lync-to-mart-staging`
- D1: `lync-to-mart-staging` (`2565c489-f0d4-43a9-8ea2-1bde5bb6fde3`)
- R2: `lync-to-mart-staging-media`
- เก็บ commit SHA และสำเนา wrangler.jsonc คู่กับแต่ละชุดสำรอง เพื่อใช้ migration/code รุ่นเดียวกันตอนตรวจและกู้คืน
- ไม่รวม Secrets ของ Worker, DNS, Stripe หรือ Postmark; ต้องจัดเก็บ/ตั้งค่าแยกด้วยระบบเก็บความลับ
- SQL มีข้อมูลสมาชิกและ password/token hashes: เก็บแบบ private/encrypted นอก public/ และ Git ห้ามส่งเข้าหน้าเว็บหรือแชต

## สำรองบนเครื่องผู้ดูแลที่เข้าสู่ Cloudflare ได้

ต้องมี Node/Wrangler, Python 3.10+ และ rclone; ทำจากโฟลเดอร์ repository
เลือกช่วงที่ไม่มีการแก้ข้อมูล/ทดสอบชำระเงิน เพราะ D1 export อาจบล็อกคำขอฐานข้อมูล และ D1/R2 ไม่ใช่ snapshot ร่วมแบบ atomic
หากมีการเขียนข้อมูลระหว่างทำ ให้สำรองรอบใหม่และตรวจอีกครั้ง ก่อนใช้เป็นจุดกู้คืน

1. สร้างโฟลเดอร์ใหม่ต่อรอบ เช่น `backups/2026-09-29-staging/media` (ห้ามใช้โฟลเดอร์เก่าทับ)
2. ตรวจชื่อ D1 เป้าหมาย แล้ว export แบบอ่านข้อมูล:

```sh
npx wrangler d1 export lync-to-mart-staging --remote --output=backups/2026-09-29-staging/database.sql
```

3. ตั้ง rclone remote ชื่อ `mart-staging-r2` ผ่าน `rclone config` โดยเลือก S3/Cloudflare และ endpoint ของบัญชีจริง ใช้ R2 token แบบอ่านวัตถุได้เฉพาะ bucket Mart นี้ ไม่ส่ง Access Key/Secret มาทางแชต
4. คัดลอกไฟล์ลงเครื่องด้วย `copy` (ไม่ใช้ sync ซึ่งอาจลบปลายทาง):

```sh
rclone copy mart-staging-r2:lync-to-mart-staging-media backups/2026-09-29-staging/media
```

ไฟล์ใน `media/` ต้องรักษา object key เป็น path เดิม ไม่มี prefix ชื่อ bucket ซ้อนเพิ่ม คำสั่งนี้สำรอง bytes; metadata เช่น Content-Type ต้องตรวจตอนกู้คืน (Mart เก็บ MIME ในตาราง media ด้วย)

## ตรวจและซ้อมกู้คืนแบบไม่แตะระบบจริง

```sh
python3 scripts/verify-backup.py --sql backups/2026-09-29-staging/database.sql --media backups/2026-09-29-staging/media > backups/2026-09-29-staging/verified.json
```

Windows ใช้ `py -3` แทน `python3` ได้ เก็บรายงานเป็น UTF-8 หาก redirect ผ่าน Windows PowerShell รุ่นเก่า
ต้องได้ exit code 0 และ `ok: true` ก่อนถือว่าผ่าน
เครื่องมือสร้าง SQLite ชั่วคราวใหม่เสมอ ไม่มีตัวเลือกเขียนทับฐานเดิม และไม่มีการเชื่อมเครือข่าย

ตรวจ:
- SQL import, SQLite integrity และ foreign keys
- ตาราง/คอลัมน์ที่จำเป็นตาม migrations ของ commit ปัจจุบัน
- จำนวนแถวแต่ละตาราง รวมสมาชิก ร้าน สินค้า ถังขยะ และประวัติชำระเงิน
- ทุกไฟล์ที่ตาราง media อ้างถึงต้องมีขนาดตรง และสร้าง SHA-256 ของ SQL/ไฟล์
- ไม่พิมพ์อีเมล password hashes หรือเนื้อหา SQL ในรายงาน

หลังย้ายชุดสำรองไปที่เก็บอีกแห่ง ให้ตรวจเทียบรายงานเดิม (อย่าเขียนทับ verified.json):

```sh
python3 scripts/verify-backup.py --sql backups/2026-09-29-staging/database.sql --media backups/2026-09-29-staging/media --expected backups/2026-09-29-staging/verified.json
```

ข้อจำกัด: ตรวจไฟล์ที่อยู่ในตาราง media ไม่ตรวจความครบของการอ้างอิงรูปทั้งหมดใน HTML/JSON, ไม่ตรวจการแสดงภาพในเบราว์เซอร์, ไม่รับรองว่า Stripe state ตรงปัจจุบัน ต้องทำ QA เหล่านี้แยก รายงานครั้งแรกเป็น baseline จึงยังตรวจการเสียหายขนาดเท่าเดิมก่อนสร้าง baseline ไม่ได้ SQL โหลดเข้า RAM ทั้งไฟล์ เหมาะกับการซ้อม Staging; ฐานใหญ่ต้องเตรียมเครื่องที่หน่วยความจำเพียงพอ

## ซ้อมกู้คืนบน Cloudflare ก่อนเปิดจริง

1. สร้าง D1/R2 ใหม่สำหรับ restore drill โดยเฉพาะ ไม่ผูก Worker ที่ให้บริการกับฐานนั้น
2. ใช้ SQL + ไฟล์จากชุดเดียวกัน นำเข้า D1 ใหม่และคัดลอกไฟล์ไป R2 ใหม่ ตรวจจำนวนแถว/วัตถุ
3. ก่อนเปิดแอปจากสำเนา ล้าง sessions, admin_swaps, password_resets และ registration_tokens ใน **สำเนาเท่านั้น** เพื่อไม่ให้ token เก่ากลับมาใช้งาน
4. Worker สำหรับ drill ต้องปิด BILLING_ENABLED, SIGNUP_ENABLED และไม่ใส่ Stripe/Postmark secrets หรือ webhook route จริง; ตั้ง noindex และจำกัดการเข้าถึงผู้ดูแล
5. ตรวจหน้าร้าน รูป แกลเลอรี rich description ธีม แคมเปญ ถังขยะ และสิทธิ์ข้ามบัญชี
6. ห้าม replay รายการ Billing จาก backup ไปหา Stripe โดยอัตโนมัติ ก่อนนำฐานกู้คืนไปใช้จริงต้องเทียบสถานะสมาชิกและรายการค้างกับ Stripe ปัจจุบัน และวางแผนรับ webhook ระหว่างกู้คืน
7. เก็บเวลาเริ่ม/เสร็จ ขนาดไฟล์ commit SHA ผลตรวจ และปัญหา เพื่อกำหนด RPO/RTO จากผลจริง

ไม่มีคำสั่ง remote restore ที่ชี้ฐานใช้งานในคู่มือนี้ การซ้อม remote และการตั้งรอบสำรองอัตโนมัติยังต้องดำเนินการหลังมีสิทธิ์ Cloudflare/R2 ที่เหมาะสม

อ้างอิง:
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/r2/examples/rclone/
