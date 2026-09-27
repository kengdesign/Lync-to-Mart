export const themes=[{id:'classic',name:'Classic Light',detail:'สว่าง · เอกลักษณ์สีแดง'},{id:'midnight',name:'Midnight',detail:'พื้นมืด · เรียบหรู'},{id:'ocean',name:'Ocean',detail:'น้ำเงิน · สะอาดตา'},{id:'sand',name:'Sand',detail:'โทนอุ่น · เส้นสายเรียบง่าย'}];
export const paidThemes=plan=>['starter','growth','brand'].includes(plan);
export const validTheme=id=>themes.some(t=>t.id===id);
export const effectiveTheme=(id,plan)=>validTheme(id)&&(id==='classic'||paidThemes(plan))?id:'classic';
