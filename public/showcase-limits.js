export const showcaseLimits=id=>({
 free:{videos:0,videoAlign:false,images:0,featured:0,newest:0,reorder:false,mobile:false},
 starter:{videos:1,videoAlign:false,images:1,featured:4,newest:0,reorder:false,mobile:false},
 growth:{videos:2,videoAlign:true,images:3,featured:8,newest:8,reorder:false,mobile:false},
 brand:{videos:2,videoAlign:true,images:6,featured:8,newest:8,reorder:true,mobile:true}
}[id]||{videos:0,videoAlign:false,images:0,featured:0,newest:0,reorder:false,mobile:false});
export const showcaseOrder=['campaigns','featured','newest'];
export function readShowcase(value){try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}}
