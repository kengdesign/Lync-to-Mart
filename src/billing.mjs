// Sandbox-only integration. Production requires a separate reviewed rollout.
import {recoveryLimit} from './password-recovery.mjs';
import {boundedHTML} from './import.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const now=()=>Math.floor(Date.now()/1000);
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export const amounts={starter:{monthly:19900,yearly:199000},growth:{monthly:49900,yearly:499000},brand:{monthly:99000,yearly:990000}};
const priceKey=(plan,period)=>`STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
export function billingReady(env){return env.APP_ENV==='staging'&&env.BILLING_ENABLED==='true'&&/^(rk|sk)_test_/.test(env.STRIPE_SECRET_KEY||'')&&!!env.STRIPE_WEBHOOK_SECRET&&!!env.STRIPE_VAT_RATE_ID&&Object.keys(amounts).every(p=>['monthly','yearly'].every(t=>/^price_/.test(env[priceKey(p,t)]||'')));}
function enabled(env){if(!billingReady(env))fail('ระบบชำระเงินทดสอบยังตั้งค่าไม่ครบ กรุณารอผู้ดูแลเปิดใช้งาน',503);}
function allowed(env,user){enabled(env);if(!(env.STRIPE_TEST_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).includes(user.email.toLowerCase()))fail('บัญชีนี้ยังไม่ได้รับสิทธิ์ทดสอบชำระเงิน',403);}
async function stripe(env,path,values=null,key){
 const headers={Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2025-09-30.clover'};
 if(values)headers['Content-Type']='application/x-www-form-urlencoded';if(key)headers['Idempotency-Key']=key;
 let res;try{res=await fetch('https://api.stripe.com/v1/'+path,{method:values?'POST':'GET',headers,body:values?new URLSearchParams(values):undefined,signal:AbortSignal.timeout(10000)});}catch{fail('ติดต่อ Stripe ไม่สำเร็จ กรุณาลองอีกครั้ง',502);}
 const data=await res.json();if(!res.ok)fail('Stripe ไม่สามารถดำเนินการได้ กรุณาตรวจการตั้งค่าหรือลองใหม่',502);
 if(data.livemode===true)fail('ไม่อนุญาตข้อมูลชำระเงินจริงใน Staging',502);return data;
}
async function account(env,id){return q(env,'SELECT * FROM billing_accounts WHERE user_id=?',id).first();}
async function locked(env,id,fn){
 await q(env,'INSERT OR IGNORE INTO billing_accounts(user_id) VALUES(?)',id).run();const token=crypto.randomUUID();
 const r=await q(env,'UPDATE billing_accounts SET lock_token=?,lock_until=? WHERE user_id=? AND lock_until<?',token,now()+180,id,now()).run();
 if(!r.meta.changes)fail('กำลังตรวจสอบการชำระเงิน กรุณารอสักครู่แล้วลองใหม่',409);
 try{return await fn(await account(env,id));}finally{await q(env,'UPDATE billing_accounts SET lock_token=NULL,lock_until=0 WHERE user_id=? AND lock_token=?',id,token).run();}
}
function selection(env,price){for(const plan of Object.keys(amounts))for(const period of ['monthly','yearly'])if(env[priceKey(plan,period)]===price?.id&&price.currency==='thb'&&price.unit_amount===amounts[plan][period]&&price.recurring?.interval===(period==='monthly'?'month':'year')&&price.recurring.interval_count===1&&price.tax_behavior==='inclusive'&&price.livemode===false)return {plan,period};return null;}
async function validatedPrice(env,plan,period){
 const [price,tax]=await Promise.all([stripe(env,'prices/'+env[priceKey(plan,period)]),stripe(env,'tax_rates/'+env.STRIPE_VAT_RATE_ID)]);
 const problems=[];
 if(!price.active)problems.push('Price ถูกปิดใช้งาน');
 if(price.id!==env[priceKey(plan,period)])problems.push('Price ID ไม่ตรง');
 if(price.livemode!==false||tax.livemode!==false)problems.push('ต้องใช้ข้อมูล Sandbox');
 if(price.currency!=='thb')problems.push('สกุลเงินต้องเป็น THB');
 if(price.unit_amount!==amounts[plan][period])problems.push(`ราคาต้องเป็น ฿${amounts[plan][period]/100} แต่ Stripe เป็น ฿${Number(price.unit_amount)/100}`);
 if(price.recurring?.interval!==(period==='monthly'?'month':'year')||price.recurring?.interval_count!==1)problems.push(`รอบราคาต้องเป็นทุก 1 ${period==='monthly'?'เดือน':'ปี'}`);
 if(price.tax_behavior!=='inclusive')problems.push(`Price ยังไม่ได้ตั้งรวมภาษี (tax_behavior=${price.tax_behavior||'unspecified'}) ให้ตั้ง Include tax in price เป็น Yes`);
 if(!tax.active)problems.push('Tax rate ถูกปิดใช้งาน');
 if(tax.percentage!==7)problems.push('Tax rate ต้องเป็น 7%');
 if(tax.inclusive!==true)problems.push('Tax rate ต้องเป็นแบบรวมภาษี (inclusive)');
 if(problems.length)fail(`ตั้งค่า ${plan} ${period==='monthly'?'รายเดือน':'รายปี'} ไม่ตรง: ${problems.join(' · ')}`,503);return price.id;
}
// Always read current Stripe state, never trust event order or browser redirects.
async function reconcile(env,row){
 if(!row.customer_id)return row;
 await settleUpgrade(env,row);
 const list=await stripe(env,`subscriptions?customer=${encodeURIComponent(row.customer_id)}&status=all&limit=100&expand[]=data.latest_invoice`);
 if(list.has_more)fail('ต้องตรวจสอบรายการชำระเงินกับผู้ดูแล',409);
 const relevant=list.data.filter(s=>s.metadata?.app==='lync-to-mart'&&s.metadata?.user_id===row.user_id);
 const ongoing=relevant.filter(s=>!['canceled','incomplete_expired'].includes(s.status));
 if(ongoing.length>1||list.data.some(s=>!relevant.includes(s)))fail('พบรายการสมัครสมาชิกที่ต้องให้ผู้ดูแลตรวจสอบ',409);
 const sub=ongoing[0]||relevant.sort((a,b)=>b.created-a.created)[0];
 if(!sub)return row;
 if(sub.livemode!==false||sub.customer!==row.customer_id)fail('ข้อมูลบัญชีชำระเงินไม่ตรงกัน',502);
 const items=sub.items?.data||[],choice=items.length===1&&items[0].quantity===1?selection(env,items[0].price):null;
 const invoice=sub.latest_invoice;
 const end=Number(items[0]?.current_period_end||0);
 const paid=choice&&sub.status==='active'&&invoice?.status==='paid'&&invoice.customer===row.customer_id&&end>now();
 const plan=paid?choice.plan:'free';
 await env.DB.batch([
 q(env,'UPDATE billing_accounts SET subscription_id=?,status=?,plan_id=?,period=?,paid_until=?,cancel_at_period_end=?,updated_at=? WHERE user_id=?',sub.id,sub.status,plan,choice?.period||null,paid?end:0,sub.cancel_at_period_end?1:0,now(),row.user_id),
 q(env,'UPDATE users SET plan_id=? WHERE id=?',plan,row.user_id)
 ]);return account(env,row.user_id);
}
export async function billingStatus(env,user){
 const row=await account(env,user.id);return {ready:billingReady(env),eligible:(env.STRIPE_TEST_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).includes(user.email.toLowerCase()),mode:'test',upgrade:await upgradeStatus(env,user.id),subscription:row?.subscription_id?{status:row.status,plan:row.plan_id,period:row.period,paid_until:row.paid_until,cancel_at_period_end:!!row.cancel_at_period_end,updated_at:row.updated_at}:null};
}
export async function checkout(env,user,input,origin){
 allowed(env,user);origin=env.RECOVERY_ORIGIN||origin;if(!await recoveryLimit(env,'billing:'+user.id,60))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);const {plan,period}=input;if(!Object.hasOwn(amounts,plan)||!Object.hasOwn(amounts[plan],period))fail('เลือกแพ็กเกจและรอบชำระให้ถูกต้อง');
 return locked(env,user.id,async row=>{
 const price=await validatedPrice(env,plan,period);
 if(!row.customer_id){const customer=await stripe(env,'customers',{email:user.email,'metadata[app]':'lync-to-mart','metadata[user_id]':user.id},'mart-customer-'+user.id);await q(env,'UPDATE billing_accounts SET customer_id=? WHERE user_id=?',customer.id,user.id).run();row=await account(env,user.id);}
 row=await reconcile(env,row);
 if(await pendingUpgrade(env,user.id))fail('มีรายการอัปเกรดค้างอยู่ กรุณาตรวจสอบก่อนสมัครใหม่',409);
 if(row.subscription_id&&!['canceled','incomplete_expired'].includes(row.status))fail('มีการสมัครสมาชิกอยู่แล้ว กรุณาจัดการรายการปัจจุบันก่อน',409);
 if(row.checkout_id){const previous=await stripe(env,'checkout/sessions/'+row.checkout_id);if(previous.status==='open'){if(row.attempt_plan===plan&&row.attempt_period===period)return {url:safeStripeURL(previous.url,'checkout.stripe.com')};await stripe(env,'checkout/sessions/'+row.checkout_id+'/expire',{});}else if(previous.status==='complete'&&!['canceled','incomplete_expired'].includes(row.status))fail('รายการชำระเงินกำลังประมวลผล กรุณากดตรวจสอบสถานะ',409);await clearAttempt(env,user.id);row=await account(env,user.id);}
 // A lost network response is retried with the exact same idempotency key/parameters.
 if(row.attempt_id&&(row.attempt_plan!==plan||row.attempt_period!==period))fail('มีรายการที่ยังตรวจสอบไม่เสร็จ กรุณาลองแพ็กเกจเดิมก่อน',409);
 if(row.attempt_id&&now()-row.attempt_created>23*3600)fail('รายการค้างเกินเวลา กรุณาให้ผู้ดูแลตรวจสอบก่อนสร้างรายการใหม่',409);
 if(!row.attempt_id){await q(env,'UPDATE billing_accounts SET attempt_id=?,attempt_plan=?,attempt_period=?,attempt_created=? WHERE user_id=?',crypto.randomUUID(),plan,period,now(),user.id).run();row=await account(env,user.id);}
 const session=await stripe(env,'checkout/sessions',{mode:'subscription',customer:row.customer_id,client_reference_id:user.id,'line_items[0][price]':price,'line_items[0][quantity]':'1','subscription_data[default_tax_rates][0]':env.STRIPE_VAT_RATE_ID,'subscription_data[metadata][app]':'lync-to-mart','subscription_data[metadata][user_id]':user.id,'metadata[app]':'lync-to-mart','metadata[user_id]':user.id,success_url:origin+'/?billing=success',cancel_url:origin+'/?billing=cancel','adaptive_pricing[enabled]':'false'},'mart-checkout-'+row.attempt_id);
 await q(env,'UPDATE billing_accounts SET checkout_id=? WHERE user_id=?',session.id,user.id).run();return {url:safeStripeURL(session.url,'checkout.stripe.com')};
 });
}
const clearAttempt=(env,id)=>q(env,'UPDATE billing_accounts SET checkout_id=NULL,attempt_id=NULL,attempt_plan=NULL,attempt_period=NULL,attempt_created=NULL WHERE user_id=?',id).run();
function safeStripeURL(value,host){try{const u=new URL(value);if(u.protocol==='https:'&&u.hostname===host)return u.href;}catch{}fail('ลิงก์จาก Stripe ไม่ถูกต้อง',502);}
export async function refreshBilling(env,user){allowed(env,user);if(!await recoveryLimit(env,'billing:'+user.id,60))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);await locked(env,user.id,row=>reconcile(env,row));return billingStatus(env,user);}
export async function cancelRenewal(env,user,input){
 allowed(env,user);if(!await recoveryLimit(env,'billing:'+user.id,60))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);if(typeof input.cancel!=='boolean')fail('ข้อมูลไม่ถูกต้อง');
 await locked(env,user.id,async row=>{row=await reconcile(env,row);if(await pendingUpgrade(env,user.id))fail('กรุณาชำระหรือยกเลิกรายการอัปเกรดที่ค้างอยู่ก่อนเปลี่ยนการต่ออายุ',409);if(!row.subscription_id||!['active','past_due'].includes(row.status))fail('ไม่มีรายการที่เปลี่ยนการต่ออายุได้',409);await stripe(env,'subscriptions/'+row.subscription_id,{cancel_at_period_end:String(input.cancel)});await reconcile(env,row);});return billingStatus(env,user);
}
export async function verifySignature(raw,header,secret,clock=now()){
 if(!secret||!header)return false;const parts=header.split(',').map(x=>x.trim()),t=parts.find(x=>x.startsWith('t='))?.slice(2);if(!/^\d+$/.test(t||'')||Math.abs(clock-Number(t))>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const part of parts.filter(x=>/^v1=[a-f0-9]{64}$/.test(x))){const signature=Uint8Array.from(part.slice(3).match(/../g),x=>parseInt(x,16));if(await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(t+'.'+raw)))return true;}return false;
}
export async function billingWebhook(req,env){
 enabled(env);const raw=await boundedHTML(req,262144);if(!await verifySignature(raw,req.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))fail('Invalid webhook signature',400);
 let event;try{event=JSON.parse(raw);}catch{fail('Invalid event');}
 if(event.livemode!==false||typeof event.id!=='string'||!event.id.startsWith('evt_'))fail('Invalid test event');
 if(await q(env,'SELECT id FROM billing_events WHERE id=?',event.id).first())return {received:true};
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'].includes(event.type))return {received:true};
 const customer=event.data?.object?.customer;if(typeof customer!=='string')return {received:true};
 const row=await q(env,'SELECT * FROM billing_accounts WHERE customer_id=?',customer).first();if(!row)return {received:true};
 await locked(env,row.user_id,async current=>{await reconcile(env,current);await q(env,'INSERT OR IGNORE INTO billing_events VALUES(?,?,?)',event.id,event.type,now()).run();});return {received:true};
}

// Monthly upgrades charge the full catalogue difference, never time-based prorations.
const pendingUpgrade=(env,id)=>q(env,"SELECT * FROM billing_upgrades WHERE user_id=? AND status IN ('pending','review')",id).first();
async function upgradeStatus(env,id){const u=await pendingUpgrade(env,id);return u?{id:u.id,plan:u.to_plan,amount:u.amount,status:u.status,cancel_at_period_end:!!u.cancel_at_period_end}:null;}
async function upgradeSubscription(env,row){
 const sub=await stripe(env,'subscriptions/'+row.subscription_id+'?expand[]=latest_invoice');
 if(sub.livemode!==false||sub.customer!==row.customer_id||sub.metadata?.app!=='lync-to-mart'||sub.metadata?.user_id!==row.user_id)fail('ข้อมูลการสมัครไม่ตรงกับบัญชี',409);
 return sub;
}
function upgradeChoice(env,sub){const item=sub.items?.data?.[0];return sub.items?.data?.length===1&&item.quantity===1?selection(env,item.price):null;}
async function upgradeQuote(env,row,plan){
 if(!Object.hasOwn(amounts,plan))fail('เลือกแพ็กเกจให้ถูกต้อง');
 if(!row.subscription_id)fail('ต้องมีแพ็กเกจรายเดือนที่ชำระแล้วก่อนอัปเกรด',409);
 const sub=await upgradeSubscription(env,row),choice=upgradeChoice(env,sub),item=sub.items?.data?.[0];
 if(sub.status!=='active'||sub.latest_invoice?.status!=='paid'||sub.latest_invoice.customer!==row.customer_id||choice?.period!=='monthly')fail('รุ่นนี้รองรับการอัปเกรดจากแพ็กเกจรายเดือนที่ชำระสำเร็จแล้ว',409);
 if(sub.schedule||sub.pending_update||sub.pause_collection||(sub.cancel_at&&sub.cancel_at!==item.current_period_end)||(sub.discounts?.length)||sub.automatic_tax?.enabled)fail('รายการสมัครมีเงื่อนไขพิเศษ กรุณาติดต่อผู้ดูแลก่อนเปลี่ยนแพ็กเกจ',409);
 if(item.current_period_end<=now()+7200)fail('ใกล้สิ้นสุดรอบแล้ว กรุณารอรอบใหม่ก่อนอัปเกรด เพื่อป้องกันยอดชำระซ้อนกับการต่ออายุ',409);
 const amount=amounts[plan].monthly-amounts[choice.plan].monthly;
 if(amount<=0)fail('เลือกแพ็กเกจที่สูงกว่าปัจจุบัน การลดแพ็กเกจยังไม่เปิดในขั้นตอนอัปเกรดนี้',409);
 const price=await validatedPrice(env,plan,'monthly');
 return {from:choice.plan,plan,period:'monthly',amount,next_amount:amounts[plan].monthly,period_end:item.current_period_end,cancel_at_period_end:!!sub.cancel_at_period_end,subscription_id:sub.id,item_id:item.id,target_price:price};
}
export async function previewUpgrade(env,user,input){
 allowed(env,user);if(!await recoveryLimit(env,'billing:'+user.id,60))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);
 return locked(env,user.id,async row=>{row=await reconcile(env,row);if(await pendingUpgrade(env,user.id))fail('มีรายการอัปเกรดค้างอยู่ กรุณาชำระหรือยกเลิกรายการเดิมก่อน',409);return upgradeQuote(env,row,input.plan);});
}
async function upgradeSession(env,u){
 if(u.session_id)return stripe(env,'checkout/sessions/'+u.session_id);
 // Never recreate an uncertain operation after Stripe's idempotency retention window.
 if(now()-u.created_at>23*3600){await q(env,"UPDATE billing_upgrades SET status='review',updated_at=? WHERE id=?",now(),u.id).run();fail('รายการอัปเกรดค้างเกินเวลา กรุณาให้ผู้ดูแลตรวจสอบ ไม่ต้องชำระซ้ำ',409);}
 const session=await stripe(env,'checkout/sessions',JSON.parse(u.session_params),'mart-upgrade-checkout-'+u.id);
 await q(env,'UPDATE billing_upgrades SET session_id=?,updated_at=? WHERE id=?',session.id,now(),u.id).run();return session;
}
export async function startUpgrade(env,user,input,origin){
 allowed(env,user);if(!await recoveryLimit(env,'billing:'+user.id,60))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);
 origin=env.RECOVERY_ORIGIN||origin;
 return locked(env,user.id,async row=>{
 const previous=await pendingUpgrade(env,user.id);row=await reconcile(env,row);let u=await pendingUpgrade(env,user.id);
 if(previous&&!u&&row.plan_id===input.plan)return {applied:true};
 if(u){if(u.status==='review')fail('รายการนี้ต้องให้ผู้ดูแลตรวจสอบ ไม่ต้องชำระซ้ำ',409);if(u.to_plan!==input.plan||!!u.cancel_at_period_end!==input.keep_cancelled)fail('มีรายการอัปเกรดค้างอยู่ กรุณาจัดการรายการเดิมก่อน',409);const session=await upgradeSession(env,u);return {url:safeStripeURL(session.url,'checkout.stripe.com')};}
 const quote=await upgradeQuote(env,row,input.plan);
 if(typeof input.keep_cancelled!=='boolean'||(!quote.cancel_at_period_end&&input.keep_cancelled))fail('ยืนยันเงื่อนไขการต่ออายุให้ถูกต้อง');
 // Reject a stale quote (e.g. another tab or a renewal); never substitute a new amount.
 if(input.from!==quote.from||input.amount!==quote.amount||input.period_end!==quote.period_end||input.expected_cancel!==quote.cancel_at_period_end)fail('ข้อมูลแพ็กเกจเปลี่ยนแล้ว กรุณาดูยอดใหม่ก่อนยืนยัน',409);
 const id=crypto.randomUUID(),created=now();
 const params={mode:'payment',customer:row.customer_id,client_reference_id:user.id,'payment_method_types[0]':'card','line_items[0][price_data][currency]':'thb','line_items[0][price_data][unit_amount]':String(quote.amount),'line_items[0][price_data][tax_behavior]':'inclusive','line_items[0][price_data][product_data][name]':`Lync to Mart — Upgrade ${quote.from} → ${quote.plan} (monthly)`,'line_items[0][quantity]':'1','line_items[0][tax_rates][0]':env.STRIPE_VAT_RATE_ID,'metadata[app]':'lync-to-mart','metadata[user_id]':user.id,'metadata[upgrade_id]':id,'payment_intent_data[metadata][upgrade_id]':id,'adaptive_pricing[enabled]':'false',expires_at:String(created+3600),success_url:origin+'/?billing=upgrade-success',cancel_url:origin+'/?billing=upgrade-cancel'};
 await q(env,'INSERT INTO billing_upgrades(id,user_id,subscription_id,item_id,from_plan,to_plan,target_price,amount,period_end,cancel_at_period_end,session_params,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,user.id,quote.subscription_id,quote.item_id,quote.from,quote.plan,quote.target_price,quote.amount,quote.period_end,input.keep_cancelled?1:0,JSON.stringify(params),created,created).run();
 u=await pendingUpgrade(env,user.id);const session=await upgradeSession(env,u);return {url:safeStripeURL(session.url,'checkout.stripe.com')};
 });
}
async function settleUpgrade(env,row){
 const u=await pendingUpgrade(env,row.user_id);if(!u||u.status==='review')return;
 const session=await upgradeSession(env,u);
 if(session.status==='expired'){await q(env,"UPDATE billing_upgrades SET status='expired',updated_at=? WHERE id=?",now(),u.id).run();return;}
 if(session.status!=='complete'||session.payment_status!=='paid')return;
 const review=async()=>{await q(env,"UPDATE billing_upgrades SET status='review',updated_at=? WHERE id=?",now(),u.id).run();};
 if(session.livemode!==false||session.mode!=='payment'||session.customer!==row.customer_id||session.client_reference_id!==row.user_id||session.metadata?.upgrade_id!==u.id||session.metadata?.user_id!==row.user_id||session.metadata?.app!=='lync-to-mart'||session.currency!=='thb'||session.amount_total!==u.amount){await review();return;}
 const sub=await upgradeSubscription(env,{...row,subscription_id:u.subscription_id}),choice=upgradeChoice(env,sub),item=sub.items?.data?.[0];
 // Detect an update whose response was lost, including after the next renewal.
 if(sub.metadata?.mart_upgrade_id===u.id&&choice?.plan===u.to_plan&&choice.period==='monthly'){
  await q(env,"UPDATE billing_upgrades SET status='applied',updated_at=? WHERE id=?",now(),u.id).run();return;
 }
 if(sub.status!=='active'||choice?.plan!==u.from_plan||choice.period!=='monthly'||item.id!==u.item_id||item.current_period_end!==u.period_end||u.period_end<=now()||sub.schedule||sub.pending_update||sub.latest_invoice?.status!=='paid'){
  // Never charge again or silently apply an old payment to a different billing cycle.
  await review();return;
 }
 await stripe(env,'subscriptions/'+u.subscription_id,{'items[0][id]':u.item_id,'items[0][price]':u.target_price,'items[0][quantity]':'1',proration_behavior:'none',cancel_at_period_end:String(!!u.cancel_at_period_end),'metadata[mart_upgrade_id]':u.id},'mart-upgrade-apply-'+u.id);
 await q(env,"UPDATE billing_upgrades SET status='applied',updated_at=? WHERE id=?",now(),u.id).run();
}
export async function abandonUpgrade(env,user){
 allowed(env,user);if(!await recoveryLimit(env,'billing:'+user.id,60))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);
 await locked(env,user.id,async row=>{
  await reconcile(env,row);const u=await pendingUpgrade(env,user.id);if(!u)return;
  if(u.status==='review')fail('รายการนี้ต้องให้ผู้ดูแลตรวจสอบ ไม่ต้องชำระซ้ำ',409);
  const session=await upgradeSession(env,u);
  if(session.status==='open')await stripe(env,'checkout/sessions/'+session.id+'/expire',{});
  else if(session.status!=='expired')fail('กำลังประมวลผลการชำระเงิน กรุณาตรวจสอบสถานะล่าสุด',409);
  await q(env,"UPDATE billing_upgrades SET status='expired',updated_at=? WHERE id=?",now(),u.id).run();
 });return billingStatus(env,user);
}
