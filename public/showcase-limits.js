export const showcaseLimits=id=>({
 free:{images:0,featured:0,newest:0,reorder:false,mobile:false},
 starter:{images:1,featured:4,newest:0,reorder:false,mobile:false},
 growth:{images:3,featured:8,newest:8,reorder:false,mobile:false},
 brand:{images:5,featured:8,newest:8,reorder:true,mobile:true}
}[id]||{images:0,featured:0,newest:0,reorder:false,mobile:false});
export const showcaseOrder=['campaigns','featured','newest'];
export function readShowcase(value){try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}}
