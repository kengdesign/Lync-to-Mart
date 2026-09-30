// Session-memory only: no search terms written to browser storage or URLs.
const fields=['search','category-filter','status-filter','quality-filter','product-sort','page-size'];
export function createCatalogViews(){
 const views=new Map();
 return {
  clear(){views.clear();},
  save(shopId,root,page){views.set(shopId,{page,values:Object.fromEntries(fields.map(id=>[id,root.querySelector('#'+id)?.value]))});},
  restore(shopId,root){
   const view=views.get(shopId);if(!view)return 1;
   for(const id of fields){const el=root.querySelector('#'+id),value=view.values[id];if(!el||value===undefined)continue;
    if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===value))continue;
    el.value=value;
   }
   return view.page;
  }
 };
}
