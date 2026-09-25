# ติดตั้ง staging บน Cloudflare ของคุณ

## สิ่งที่ต้องมี

1. บัญชี Cloudflare ที่เข้าถึง Workers, D1 และ R2 ได้
2. Node.js 24+ และ Wrangler จาก registry ทางการ ติดตั้งในเครื่องทำงานของคุณด้วย `npm install --save-dev --save-exact wrangler` แล้วเก็บ package-lock.json ใน repository
3. URL สินค้า Thaimart จริง 1–3 รายการ เพื่อระบุโดเมน checkout ที่ถูกต้องและทดสอบการนำเข้า
4. ยืนยันว่าเจ้าของร้าน/เงื่อนไขต้นทางอนุญาตให้ดึงและนำข้อมูลมาใช้ ก่อนเปิด IMPORT_HOSTS

ไม่ต้องส่งรหัสผ่าน Cloudflare หรือ API token ในแชต ใช้ `npx wrangler login` ในเครื่องของคุณ หรือ secret store ของระบบ CI ที่คุณควบคุม

## ขั้นตอน staging

```bash
npx wrangler login
npx wrangler d1 create lync-to-mart-staging
npx wrangler r2 bucket create lync-to-mart-staging-media
```

นำ database_id ที่สร้างจริงใส่ใน wrangler.jsonc แทน REPLACE_WITH_STAGING_D1_ID; ตรวจชื่อ bucket และ account ให้ถูกต้อง ห้ามใช้ฐานข้อมูล production เดิม

ตั้ง `CHECKOUT_HOSTS` เป็นรายชื่อ hostname ของ Thaimart ที่ตรวจสอบแล้ว คั่นด้วย comma ไม่ใส่ https:// หรือ path ระบบตรวจ exact host และไม่ยอมรับโดเมนย่อยโดยอัตโนมัติ

`IMPORT_HOSTS` เว้นว่างจนกว่าจะยืนยันสิทธิ์และวิธีนำเข้า เมื่อเปิด importer จะอ่าน HTML / Product JSON-LD เท่านั้น ไม่รัน JavaScript, ไม่ตาม redirects, timeout 8 วินาที และจำกัด response 1 MB หากต้นทางไม่รองรับให้ใช้การกรอกข้อมูลแทน

```bash
npx wrangler d1 migrations apply lync-to-mart-staging --remote
```

สร้างบัญชี staging ใน terminal โดยตั้ง `MART_USER_EMAIL` และ `MART_USER_PASSWORD` ผ่าน secure input/environment ของเครื่องคุณ (รหัสผ่านอย่างน้อย 12 ตัว):

```bash
node scripts/create-user.mjs
npx wrangler d1 execute lync-to-mart-staging --remote --file=.user-bootstrap.sql
```

ลบ `.user-bootstrap.sql` เมื่อใช้เสร็จ จากนั้น:

```bash
npm test
npm run check
npx wrangler deploy --dry-run
npx wrangler deploy
```

เข้า URL staging ที่ Wrangler คืนมา ล็อกอินด้วยบัญชีที่สร้างเอง ทดลองร้านใหม่ → draft product → publish product → publish shop → เปิดหน้าร้าน → คลิกไป Thaimart → ดูสถิติ ทดสอบข้ามบัญชีและหน้าจอมือถือด้วย

## การเชื่อม lyncto.link ภายหลัง

เป้าหมาย `/mart` สำหรับแนะนำบริการ และ `/shop/{slug}` สำหรับหน้าร้าน ยังไม่ได้เชื่อมในรุ่นนี้ ควรเก็บหลังบ้านไว้ staging/subdomain ก่อนตัดสินใจ production routing

ต้องตรวจ Cloudflare zone, proxy, Worker routes และ WordPress routes ปัจจุบันก่อนเปลี่ยน route ใด ๆ เพื่อไม่ทับ `/dashboard`, ระบบสมาชิก, Short Link หรือ Lync to LINE ของเดิม

## ก่อน production

- เลือกวิธีใช้บัญชี Lyncto เดิม: signed exchange/SSO ที่ตรวจ server-side; อย่าเชื่อ user_id จาก client
- เพิ่ม registration/recovery/verification และ rate limits ที่เหมาะสม รวม MFA สำหรับผู้ดูแล
- pin Wrangler version และ lockfile หลังติดตั้งจริง; CI, staging smoke test และ rollback version
- quota media แบบ atomic, ลบ orphan uploads, จำกัดรูปตาม plan และตรวจ decode รูปจริง
- จำกัด payload แบบ streaming, ตรวจ host configuration, request throttling โดยเฉพาะ import/upload/login
- privacy notice, consent, bot filtering, analytics retention และการลบข้อมูลตามวงจรบัญชี
- backup/restore drill ของ D1 และ R2, monitoring/error alerts และ admin audit log
- ทดสอบ Workers runtime จริง, R2 จริง, concurrency และ billing webhooks ก่อนขาย

## เอกสารทางการที่ใช้อ้างอิง

- https://developers.cloudflare.com/d1/worker-api/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/workers/static-assets/binding/
