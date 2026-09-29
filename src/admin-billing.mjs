// Local support view only; never mutates or refreshes Stripe subscriptions.
export async function adminBilling(env,role,url){
 if(role!=='owner')throw Object.assign(new Error('เฉพาะแอดมินสูงสุดเท่านั้นที่ดูข้อมูลชำระเงินได้'),{status:403});
 const filter=url.searchParams.get('billing_filter')||'';
 if(!['','attention','ending'].includes(filter))throw Object.assign(new Error('ตัวกรองชำระเงินไม่ถูกต้อง'),{status:400});
 const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page'),10)||1));
 const search=(url.searchParams.get('q')||'').trim().slice(0,100),pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
 const from=`FROM billing_accounts b JOIN users u ON u.id=b.user_id LEFT JOIN billing_upgrades up ON up.user_id=b.user_id AND up.status IN ('pending','review') LEFT JOIN billing_downgrades down ON down.user_id=b.user_id AND down.status IN ('creating','scheduled','releasing','review') LEFT JOIN billing_cards card ON card.user_id=b.user_id AND card.status IN ('pending','review')`;
 const attention="(b.status IN ('past_due','unpaid','incomplete') OR up.id IS NOT NULL OR card.id IS NOT NULL OR down.status IN ('creating','releasing','review'))";
 const where=`WHERE u.email LIKE ? ESCAPE '\\' ${filter==='attention'?'AND '+attention:filter==='ending'?'AND b.cancel_at_period_end=1':''}`;
 const total=(await env.DB.prepare('SELECT COUNT(*) total '+from+' '+where).bind(pattern).first()).total;
 const rows=(await env.DB.prepare(`SELECT card.status AS card_status,u.id,u.email,b.status,b.plan_id,b.period,b.paid_until,b.cancel_at_period_end,b.updated_at,b.customer_id,b.subscription_id,up.status AS upgrade_status,up.to_plan AS upgrade_plan,up.amount AS upgrade_amount,down.status AS downgrade_status,down.to_plan AS downgrade_plan,down.effective_at AS downgrade_at ${from} ${where} ORDER BY b.updated_at DESC,u.id LIMIT 25 OFFSET ?`).bind(pattern,(page-1)*25).all()).results;
 const stats=await env.DB.prepare(`SELECT COUNT(*) accounts,COALESCE(SUM(CASE WHEN ${attention} THEN 1 ELSE 0 END),0) attention,COALESCE(SUM(b.cancel_at_period_end),0) ending ${from}`).first();
 return {role,view:'billing',rows,total,page,pages:Math.max(1,Math.ceil(total/25)),stats};
}
