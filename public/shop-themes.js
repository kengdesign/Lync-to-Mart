export const themes=[{id:'classic',name:'Classic Light',detail:'สว่าง · เอกลักษณ์สีแดง'},{id:'midnight',name:'Midnight',detail:'พื้นมืด · เรียบหรู'},{id:'ocean',name:'Ocean',detail:'น้ำเงิน · สะอาดตา'},{id:'sand',name:'Sand',detail:'โทนอุ่น · เส้นสายเรียบง่าย'},{id:'pop',name:'Pop Violet',detail:'ม่วงสด · สนุกแบบ Gen Z',brandOnly:true},{id:'neo',name:'Neo Lime',detail:'ไลม์ · กรอบคมสไตล์กราฟิก',brandOnly:true},{id:'peach',name:'Peach Studio',detail:'พีชอบอุ่น · นุ่มนวลทันสมัย',brandOnly:true},{id:'graphite',name:'Graphite Gold',detail:'เทาเข้มทอง · เรียบหรู',brandOnly:true}];
export const paidThemes=plan=>['starter','growth','brand'].includes(plan);
export const validTheme=id=>themes.some(t=>t.id===id);
export const themeAllowed=(id,plan)=>validTheme(id)&&(id==='classic'||(themes.find(t=>t.id===id).brandOnly?plan==='brand':paidThemes(plan)));
export const effectiveTheme=(id,plan)=>themeAllowed(id,plan)?id:'classic';
