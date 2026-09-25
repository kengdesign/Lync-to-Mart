# Verification — 25 September 2026

## ผ่านในสภาพแวดล้อม local

- `npm test`: 3 suites-as-test cases ผ่าน ครอบคลุม HTTP handler เดียวกับที่ใช้ใน Worker ผ่าน SQLite adapter
- Store lifecycle: create, draft hidden, publish, HTML escaping, redirect target, real click persistence
- Security: authentication required, cross-origin mutation rejected, tenant isolation, logout invalidates session
- Quotas: Free 1 shop and 10 products, enforcement from database plan values
- Import parsing: THB numeric/zero, missing price/null, foreign currency/null, missing JSON-LD
- Login: repeated failed attempts blocked at threshold
- JavaScript syntax checks: worker and browser client
- Local server starts successfully with a random local-only test account

## ยังไม่ได้ยืนยัน

- Browser UI interaction/screenshot QA: Cloud Browser ถูกปฏิเสธการเข้าถึง `http://127.0.0.1:8787` ด้วย ERR_BLOCKED_BY_CLIENT ไม่มีการอ้างว่าตรวจหน้าจอ desktop/mobile ผ่าน
- Cloudflare Worker actual deployment, D1 service, R2 service, upload durability and concurrency
- Real Thaimart URL extraction, checkout hostname and permission
- AI, Stripe, Lyncto SSO, LINE or third-party integrations

## ข้อจำกัดของ 0.1.0

- Login บัญชีสร้างโดยผู้ดูแล ไม่มี public signup/recovery
- Local checkout domain เป็น placeholder สำหรับการทดสอบ ไม่ใช่เว็บขายจริง
- Media 500 MB ต่อบัญชีเป็นเพดานชั่วคราว ยังไม่ผูกแพ็กเกจและยังไม่ atomic; orphan cleanup ยังไม่มี
- Analytics เป็น raw events รวม bot/refresh; ไม่ใช่ unique visitors/orders; แสดง 30 วันเหมือนกันทุกแพ็กเกจ ยังไม่มี retention jobs
- Import API ไม่มี caching/queue/rate budget ต่อบัญชี จึงปิดโดย default
- หน้าร้านใช้ no-store เพื่อความถูกต้องเมื่อ publish/unpublish; CDN cache versioning ยังไม่ทำ
- รูปอัปโหลดตรวจ signature และขนาด แต่ยังไม่ทำ decode/re-encode/compression
- เปลี่ยน slug, product reorder, social metadata, pagination และ paid plans management ยังไม่ทำ
- ไม่มี live preview URL ที่เผยแพร่ให้ผู้ใช้ในรอบนี้
