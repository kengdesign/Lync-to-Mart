// The override is scoped to this staging deployment and the owner of one known shop.
export const planExpression="CASE WHEN ?='staging' AND ? IN ('starter','growth','brand') AND EXISTS(SELECT 1 FROM shops trial WHERE trial.id=? AND trial.owner_id=u.id) THEN ? ELSE u.plan_id END";
export const planBindings=env=>[env.APP_ENV||'',env.STAGING_TEST_PLAN||'',env.STAGING_TEST_SHOP_ID||'',env.STAGING_TEST_PLAN||''];
export async function effectivePlan(env,user){const plan=await env.DB.prepare(`SELECT pl.* FROM users u JOIN plans pl ON pl.id=(${planExpression}) WHERE u.id=?`).bind(...planBindings(env),user.id).first();return {...plan,staging_test:env.APP_ENV==='staging'&&plan.id!==user.plan_id};}
