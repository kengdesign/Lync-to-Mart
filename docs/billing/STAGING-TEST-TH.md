# คู่มือตั้งค่าและทดสอบ Stripe — Lync to Mart Staging

โค้ดรุ่นนี้ทำงานเฉพาะ APP_ENV=staging และคีย์ทดสอบ ไม่เปิดรับเงินจริง
ไม่จำเป็นต้องเชื่อมปลั๊กอิน Stripe ใน GPT เพื่อให้ Mart ทำงาน

## 1. สร้าง Sandbox แยกสำหรับ Mart

เปิด Stripe Dashboard แล้วเลือก Sandbox หรือสร้าง Sandbox ชื่อ `Lync to Mart Staging` ผ่านตัวเลือกบัญชี
อย่าเลือกบัญชี Live หรือใช้สินค้า/ราคาของ Lync to Line ปะปน
ดู https://docs.stripe.com/sandboxes และ https://docs.stripe.com/testing

## 2. สร้างสินค้า 3 รายการ และราคา Recurring 6 ราคา

| สินค้า | รายเดือน THB | รายปี THB |
|---|---:|---:|
| Lync to Mart — Starter | 199 | 1,990 |
| Lync to Mart — Growth | 499 | 4,990 |
| Lync to Mart — Brand | 990 | 9,900 |

แต่ละราคา: currency THB, flat rate/per-unit, quantity 1, interval count 1, recurring month หรือ year ตามตาราง และ **Tax behavior: Inclusive**
ยอดนี้รวม VAT แล้ว ไม่บวกเพิ่ม 7% และไม่ใช้ราคาเฉลี่ยต่อเดือนเป็นยอดเรียกเก็บรายปี
บันทึก Price ID ทั้ง 6 ค่า (`price_...`) ไม่ใช่ Product ID (`prod_...`)
Free ไม่ต้องสร้างใน Stripe

สร้าง Tax rate ชื่อ VAT: 7%, Inclusive=true, active, Country TH ใน Sandbox นี้
บันทึก Tax rate ID (`txr_...`) โค้ดตรวจอัตราและสถานะก่อนสร้าง Checkout
ไม่เปิด Automatic Tax ซ้ำกับอัตรา manual นี้ การตั้งค่านี้ใช้ทดสอบเท่านั้น ต้องตรวจการจด VAT/ข้อมูลผู้ประกอบการก่อน Production

## 3. สร้างคีย์ Sandbox และใส่ Cloudflare Secrets

แนะนำ Restricted API key (`rk_test_...`) ของ Sandbox นี้:
Customers: Write; Checkout Sessions: Write; Subscriptions: Write; Prices: Read; Tax rates: Read; Invoices: Read
Read ต้องครอบคลุมการอ่าน latest invoice แบบ expanded ของ Subscriptions
หากสิทธิ์ไม่ครบ API จะปิดการทำรายการและแจ้งข้อผิดพลาด ไม่เพิ่มสิทธิ์เอง

ใน Cloudflare เลือก Worker **lync-to-mart-staging** → Settings → Variables and Secrets → เพิ่มค่าแบบ **Secret** ตามตาราง
ใช้ชนิด Secret แม้ค่าบางตัวไม่ใช่ความลับ เพื่อให้คงอยู่เมื่อ Workers Builds deploy จาก wrangler.jsonc รอบถัดไป
อย่าวางคีย์ในแชต, GitHub, JavaScript ฝั่งหน้าเว็บ หรือ Worker ของระบบอื่น

| ชื่อ | ค่า |
|---|---|
| STRIPE_SECRET_KEY | คีย์ Sandbox `rk_test_...` |
| STRIPE_PRICE_STARTER_MONTHLY | price_... ของ Starter 199/เดือน |
| STRIPE_PRICE_STARTER_YEARLY | price_... ของ Starter 1990/ปี |
| STRIPE_PRICE_GROWTH_MONTHLY | price_... ของ Growth 499/เดือน |
| STRIPE_PRICE_GROWTH_YEARLY | price_... ของ Growth 4990/ปี |
| STRIPE_PRICE_BRAND_MONTHLY | price_... ของ Brand 990/เดือน |
| STRIPE_PRICE_BRAND_YEARLY | price_... ของ Brand 9900/ปี |
| STRIPE_VAT_RATE_ID | txr_... ของ VAT 7% Inclusive |
| STRIPE_TEST_EMAILS | paiboon@chiistudio.com (เพิ่มผู้ทดสอบอื่นคั่นด้วย comma ได้) |
| STRIPE_WEBHOOK_SECRET | whsec_... จากขั้นตอน 4 |
| BILLING_ENABLED | true — ใส่เป็นขั้นตอนสุดท้ายเมื่อค่าด้านบนครบ |

ไม่มี Publishable key เพราะใช้ Hosted Checkout โดยเซิร์ฟเวอร์สร้าง session แล้วเปิดหน้าของ Stripe โดยตรง
ไม่ต้องแก้ Deploy command หรือ D1 ด้วยตัวเอง migration 0017 ใช้ในขั้นตอน deploy ตามปกติ

## 4. สร้าง Webhook destination ใน Sandbox

URL:
`https://lync-to-mart-staging.paiboon.workers.dev/api/billing/webhook`

เลือก Events from your account (ไม่ใช่ Connected accounts), JSON snapshot events และ API version `2025-09-30.clover` หากเลือกได้
โค้ด API requests pin เวอร์ชันนี้; Webhook ใช้เพียง event ID/type/customer แล้วอ่าน subscription ปัจจุบันจาก Stripe อีกครั้ง

Events ที่เลือก:
- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid
- invoice.payment_failed

คัดลอก Signing secret (`whsec_...`) ลง Secret ตามขั้นตอน 3 แล้วเปิด BILLING_ENABLED=true
หากลองส่งก่อนตั้งค่าครบจะได้ HTTP 503; หลังเปิดแล้วให้ Retry delivery
Webhook ไม่ต้องมี Origin หรือ login cookie แต่ต้องมี Stripe-Signature ถูกต้องและเวลาไม่เกิน 5 นาที

## 5. ทดลองชำระเงิน

1. ล็อกอินบัญชีผู้ทดสอบ → เมนู **แพ็กเกจ** → **ทดสอบชำระเงิน · Stripe Sandbox**
2. เลือก Starter + รายเดือน ต้องแสดง **199 บาท รวม VAT 7%**
3. กดไปชำระเงินทดสอบ Stripe ต้องอยู่ในโหมดทดสอบ
4. ใช้บัตรทดสอบ `4242 4242 4242 4242`, วันหมดอายุในอนาคต, CVC 3 หลักใดก็ได้ ห้ามใช้บัตรจริง
5. หลังกลับ Mart กด **ตรวจสอบสถานะล่าสุด** ระบบโหลดสิทธิ์ใหม่หลังตรวจ Stripe
6. Stripe total ต้องเท่าราคาที่แสดง ไม่บวก VAT ซ้ำ ตรวจ invoice ใน Sandbox ประกอบ (เอกสารนี้ยังไม่รับรองว่าเป็นใบกำกับภาษีไทย)
7. ลองกดเปิด Checkout ซ้ำสำหรับแพ็กเกจเดิม ต้องกลับ session เดิม หากมี subscription อยู่จะไม่สร้างการสมัครซ้ำ
8. ลองยกเลิกต่ออายุ ต้องยังใช้แพ็กเกจได้ถึงสิ้นรอบ และเปิดต่ออายุอีกครั้งได้ก่อนสิ้นสุด
9. ทดสอบบัตรปฏิเสธ `4000 0000 0000 0002` กับบัญชีผู้ทดสอบอีกบัญชี ระบบต้องไม่ให้สิทธิ์ paid
10. ทดสอบ webhook replay และการต่ออายุด้วย Stripe Billing test clocks/สถานการณ์ Sandbox ต้องอ่านสถานะล่าสุดและไม่ให้สิทธิ์ซ้ำจาก event เก่า

ดูบัตรและสถานการณ์ทดสอบ: https://docs.stripe.com/testing

## พฤติกรรมและขอบเขตของรุ่นนี้

- ยังต้องทดสอบกับ Sandbox จริงหลังตั้งค่า: ชุดทดสอบใน repo จำลอง Stripe API ไม่ใช่หลักฐานว่าชำระเงินปลายทางจริงผ่านแล้ว
- หลังพบ subscription แรก สิทธิ์ Brand สำหรับทดสอบเดิมจะไม่กลบแพ็กเกจที่ชำระอีก ส่วนโปรโมชั่นที่แอดมินตั้งยังมีลำดับความสำคัญสูงสุด
- ระบบให้สิทธิ์ paid เมื่อ subscription active + latest invoice paid + ราคาและรอบตรงกับ Mart + ยังไม่หมดรอบเท่านั้น
- past_due/unpaid/canceled/expired กลับ Free ไม่มี grace period รุ่นนี้ ข้อมูลสินค้าไม่ถูกลบ
- ถ้า webhook ขาดหาย เมื่อหมด paid_until สิทธิ์กลับ Free อย่างปลอดภัย กดตรวจสอบสถานะเพื่อคืนสิทธิ์หลัง Stripe ยืนยันชำระ
- เปลี่ยนแพ็กเกจระหว่างรอบ/proration, Customer Portal, ปุ่มดาวน์โหลด invoice, refunds/disputes และ Production ยังไม่รวมในรุ่นนี้
- ทดสอบครบ 6 ราคาโดยใช้ผู้ทดสอบแยก หรือยกเลิก subscription ทดสอบให้สิ้นสุดใน Sandbox ก่อนสมัครรอบใหม่
- ห้ามใช้การปรับสิทธิ์จากหน้า Admin แทนการยกเลิก subscription การระงับสมาชิกร้านค้าไม่ได้หยุดการเรียกเก็บเงิน Stripe
- หาก request สร้าง Checkout ขาดการตอบกลับ ระบบ retry ด้วย idempotency key เดิม หากค้างเกิน 23 ชั่วโมงจะหยุดให้ผู้ดูแลตรวจ ไม่สร้างซ้ำเสี่ยงคิดเงินซ้อน
- ห้ามลบ/เปลี่ยน mapping customer, เปลี่ยนไป Sandbox ใหม่ หรือสลับค่า Price ID ระหว่างมี subscription ทดสอบค้าง ต้องเคลียร์และวางแผน migration ก่อน


## รอบแก้ไข 28 กันยายน: เริ่มทดสอบใหม่อย่างชัดเจน

- ปิดสิทธิ์ Brand จาก STAGING_TEST_PLAN โดยตั้งเป็น free; ไม่แก้ข้อมูลสินค้า สมาชิก Stripe หรือโปรโมชั่นแอดมิน
- ตรวจคลิปแล้วพบ validation ราคา/รอบ/VAT ไม่ผ่าน ไม่ใช่ปุ่มไม่ทำงาน
- ข้อผิดพลาดระบุเงื่อนไขที่ไม่ตรงและแสดงเหนือปุ่ม พร้อมสถานะกำลังดำเนินการ
- การ์ดเปรียบเทียบเลือกแพ็กเกจ/รอบไปยังแผงชำระเงินได้
- ลำดับทดสอบ: Free → Starter รายเดือน → ยืนยันชำระเงินและสิทธิ์ → ยกเลิกต่ออายุ → เปิดต่ออายุอีกครั้ง
- ยกเลิกหมายถึงหยุดรอบถัดไป ไม่คืนเงินหรือยกเลิกสิทธิ์ทันที
- หลังหมดรอบเป็น Free โดยไม่ลบสินค้า; ข้อจำกัดตาม Free ยังคงใช้
- ยังไม่ได้เปิด upgrade/downgrade ระหว่างรอบหรือเปลี่ยนรอบรายเดือน/รายปี ต้องพัฒนาและทดสอบแยกก่อนใช้งาน
- แนวทางรอบถัดไปที่เสนอ: อัปเกรดแสดงส่วนต่างให้ยืนยันก่อนจ่ายและเปิดสิทธิ์เมื่อจ่ายสำเร็จ; ดาวน์เกรดมีผลเมื่อครบรอบ ไม่ลดสิทธิ์ทันที
- ห้ามล้าง billing_accounts เพื่อรีเซต หากมี subscription อยู่จริง ต้องจัดการกับ Stripe ให้สอดคล้องกัน


## อัปเกรดรายเดือนแบบส่วนต่างราคาเต็ม — 28 กันยายน 2026

- Starter → Growth: 300 บาท, Starter → Brand: 791 บาท, Growth → Brand: 491 บาท รวม VAT 7% แล้ว
- ไม่คิด prorate ตามวัน/เวลาคงเหลือ ไม่เริ่มรอบใหม่ คงวันครบรอบเดิม
- เลือกแพ็กเกจ → ดูยอด → ยืนยันเงื่อนไขต่ออายุ → Stripe Checkout แบบชำระครั้งเดียว → webhook ยืนยันว่า paid → เปลี่ยน price ของ subscription เดิมด้วย proration_behavior=none
- ถ้ายกเลิกต่ออายุอยู่ ค่าเริ่มต้นคือคงยกเลิกไว้ ผู้ใช้ต้องเลือกเองหากต้องการกลับมาต่ออายุ
- ไม่มีการสร้าง subscription ใหม่สำหรับอัปเกรด รอบถัดไป (หากต่ออายุ) ใช้ราคาเต็มของแพ็กเกจใหม่
- ทดสอบจากร้าน Starter ปัจจุบันได้เลย ไม่ต้องรีเซตเป็น Free
- ก่อนทดสอบ Growth/Brand ตรวจ Price รายเดือนอีกสองรายการให้ tax_behavior=inclusive เช่นเดียวกับ Starter; ระบบตรวจและแจ้งข้อความก่อนเปิด Checkout
- ใช้ restricted key เดิม: Checkout Sessions Write, Subscriptions Write, Prices Read, Tax Rates Read; ไม่ต้องเพิ่ม webhook event ใหม่
- ทดสอบ: จ่ายสำเร็จ, ปิด Checkout โดยไม่จ่ายแล้วกลับมาทำต่อ, ยกเลิกรายการค้าง, กดซ้ำ, คงยกเลิกต่ออายุ, กลับมาต่ออายุ และตรวจวันครบรอบเดิม
- ชุดทดสอบจำลองตรวจยอดทั้งสามคู่, idempotency, network response lost, webhook retry, unpaid ไม่เปิดสิทธิ์ และรายการจ่ายผิดยอด/ข้ามรอบส่งตรวจสอบ
- จำกัดรายเดือนในรุ่นนี้; รายปี/เปลี่ยนรอบและดาวน์เกรดยังไม่เปิด
- ไม่เริ่มรายการใน 2 ชั่วโมงสุดท้ายของรอบ; Checkout มีอายุ 1 ชั่วโมง ป้องกันแข่งกับการต่ออายุ
- ถ้าจ่ายแล้วแต่ subscription เปลี่ยนเงื่อนไขหรือข้ามรอบก่อนประมวลผล จะขึ้นสถานะ review ให้ผู้ดูแลตรวจสอบ ไม่เรียกเก็บซ้ำ ไม่คืนเงินอัตโนมัติ
- migration 0018 เก็บประวัติและรายการค้าง; ข้อมูลเก่าไม่ถูกลบ การย้อน code ไม่ต้องลบตาราง


## นโยบายล่าสุด: ช่วงสิทธิ์หักส่วนต่างและรอบใหม่ (แทนนโยบายด้านบน)

- รายเดือน: ภายใน 15×24 ชั่วโมงจากเริ่มรอบ จ่ายส่วนต่าง; เกินช่วงนี้จ่ายราคาเต็มและเริ่มรอบใหม่ 1 เดือน
- รายปี: ภายใน 6 เดือนตามปฏิทินเวลาไทยจากเริ่มรอบ จ่ายส่วนต่างราคารายปี; เกินช่วงนี้จ่ายเต็มและเริ่มรอบใหม่ 1 ปี
- เวลาตรงเส้นสิ้นสุดยังได้ส่วนต่าง หลังจากนั้น 1 วินาทีเป็นราคาเต็ม; วันปลายเดือน clamp เช่น 31 ส.ค. → 28/29 ก.พ.
- การอัปเกรดส่วนต่างไม่รีเซตวันเริ่มรอบหรือช่วงส่วนต่าง อัปเกรดได้เฉพาะชนิดรอบเดิม ไม่สลับเดือน/ปี
- ยอดยืนยันถูกคำนวณใหม่ฝั่ง server; ถ้าข้ามเส้นเวลาหลังดูยอดต้องดูยอดใหม่ ไม่เปลี่ยนยอดเรียกเก็บเงียบๆ เมื่อสร้าง Checkout แล้วจะล็อกยอดที่ยืนยันไว้ตลอดอายุรายการ 1 ชั่วโมง
- ชำระเต็มแล้วเริ่มนับรอบใหม่เมื่อ server ยืนยัน paid ไม่หัก/ทบเวลาที่เหลือ
- แสดงนโยบายเหนือการ์ดราคาแก่ทุกบัญชี พร้อมยอด วิธีคิด และวันสิ้นสุดสิทธิ์ในหน้าก่อนยืนยัน
- Stripe implementation: one-time Checkout collects full price; existing subscription switches to target price with proration_behavior=none and trial_end at the new paid-term end. This defers the next debit instead of billing a duplicate full invoice via billing_cycle_anchor=now. Stripe Dashboard may show trialing internally, while Mart shows active ONLY with an applied, verified full-payment record matching subscription, plan and term. No free trial is offered to merchants.
- Full-term reset requires classic billing mode; flexible mode is blocked before charging pending separate support. Existing ordinary subscriptions are unaffected.
- Renew/cancel uses the new term end; default remains canceled if it was canceled. A later difference upgrade preserves the prepaid term and its original discount deadline.
- migration 0019 is additive. Old unpaid upgrade Checkout sessions are expired for fresh policy calculation; paid historical sessions are honored.
- Automated tests: monthly/yearly boundary, leap years/month ends, stale quotes, annual difference, full monthly/annual price and new term, no double debit request, retry recovery, cancellation, chained upgrades, unpaid trial rejection, next paid renewal.
- Manual Sandbox acceptance still required for actual Stripe invoice/trial_end transitions (both renewal-on and canceled subscriptions); don't infer live acceptance from API mocks.


## ลดแพ็กเกจเมื่อครบรอบ (Staging)

- รองรับ Brand → Growth/Starter และ Growth → Starter ในรอบเดือนหรือปีเดิม วันนี้ไม่เก็บเงิน ไม่คืนเงินส่วนต่าง และไม่ลดสิทธิ์ทันที
- เมนูแพ็กเกจ → ลดแพ็กเกจเมื่อครบรอบ → ดูรายละเอียด → ยืนยัน; แสดงวันมีผลและยอดต่ออายุรวม VAT
- ยกเลิกคำขอก่อนวันมีผลได้ เป็นการ release schedule เท่านั้น ไม่ยกเลิกสมาชิกและไม่ปิดการต่ออายุ
- ถ้ายกเลิกต่ออายุไว้ ต้องกดเปิดต่ออายุก่อนตั้งคำขอลดแพ็กเกจ ไม่มีการเปิดต่ออายุแอบแฝง
- ถ้าจะอัปเกรดหรือยกเลิกต่ออายุ ต้องยกเลิกคำขอลดแพ็กเกจก่อน ป้องกันคำสั่งขัดกัน
- หากต้องการกลับ Free ให้ใช้ปุ่มยกเลิกต่ออายุเดิม
- Stripe Subscription schedules ผูก subscription เดิม: phase ปัจจุบันใช้ราคาเดิมจนถึง paid_until, phase ถัดไปใช้ราคาใหม่, proration_behavior=none, end_behavior=release; prepaid trial_end ถูกเก็บไว้ใน phase แรก
- Restricted key อาจต้องเพิ่ม Subscription schedules: Write ในคอลัมน์ “ในบัญชีของคุณ” โดยใช้ key เดิม ไม่ต้องส่ง secret ในแชต ข้อผิดพลาด 403 จะแจ้งเฉพาะจุดนี้
- ไม่ต้องเพิ่ม webhook event ใช้ customer.subscription.updated และ invoice.paid/payment_failed เดิม ดึงสถานะปัจจุบันเสมอ
- ตาราง 0020 เก็บคำขอและ Stripe idempotency keys รองรับ retry เมื่อ response สูญหายทั้ง create/configure/release
- ข้อมูลสินค้า/ร้านไม่ถูกลบเมื่อเปลี่ยนแพ็กเกจ การเพิ่มข้อมูลและฟีเจอร์ใช้โควตาแพ็กเกจใหม่ตามระบบเดิม
- ชุดทดสอบจำลอง: รายเดือน/รายปี, ไม่เก็บวันนี้, ไม่ลดสิทธิ์ก่อนวัน, ยกเลิกคำขอ, ราคาถัดไป, ชำระไม่ผ่าน, retry/network loss, canceled renewal guard, prepaid term preservation
- ขั้นรับรอง Sandbox: ตั้งคำขอจาก Brand → Growth ตรวจวัน/ราคาใน Stripe แล้วยกเลิกคำขอ; ใช้บัญชีทดสอบแยกและ Test Clock สำหรับ transition/renewal (ยังไม่ได้ทำแทนผู้ใช้)
- ไม่เริ่มคำขอใน 2 ชั่วโมงสุดท้ายของรอบ; ไม่ยกเลิกคำขอภายใน 60 วินาทีก่อนมีผลเพื่อหลีกเลี่ยงแข่งกับ phase transition
