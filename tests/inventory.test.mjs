import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,mocks={}){
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(source,{exports,require:name=>{
  if(name in mocks)return mocks[name];
  const files={'@/data/products':'../src/data/products.ts','@/lib/inventory':'../src/lib/inventory.ts','@/lib/phone-conditions':'../src/lib/phone-conditions.ts','@/lib/database-errors':'../src/lib/database-errors.ts'};
  if(files[name])return load(files[name]);throw new Error(name);
 }});return exports;
}
function setup(admin=true,uploads=[]){
 const states=new Map();
 const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from:table=>{
  if(table==='admin_users')return{select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{user_id:'admin'}:null})})})};
  if(table==='phone_uploads')return{select:()=>({order:async()=>({data:uploads}),eq:(_key,id)=>({maybeSingle:async()=>({data:uploads.find(phone=>phone.id===id)||null})})})};
  return{select:async()=>({data:[...states.values()]}),upsert:async row=>{states.set(row.product_id,{...states.get(row.product_id),...row});return{};}};
 }};
 return {...load('../src/app/admin/actions.ts',{'@/lib/supabase/server':{createClient:async()=>client}}),states};
}
function details(){const form=new FormData();for(const [key,value]of Object.entries({phoneType:'Edited iPhone',brand:'Apple',price:'390000',description:'Inspection pending',colors:'Black, Blue',storage:'128GB, 256GB'}))form.set(key,value);return form;}

test('inventory management requires admin access for edit and removal',async()=>{
 const action=setup(false);
 assert.ok((await action.editInventoryPhone('iphone-13',details())).error);
 assert.ok((await action.removeInventoryPhone('iphone-13',true)).error);
 assert.ok((await action.removeInventoryPhone('iphone-13',false)).error);
 assert.equal(action.states.size,0);
});
test('uploaded phones can be removed and restored without changing publication or booking',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const uploaded={id,name:'Uploaded Phone',brand:'Samsung',price:250000,description:'Original description',colors:['Black'],storage:['256GB'],is_published:true};
 const action=setup(true,[uploaded]);
 assert.equal((await action.removeInventoryPhone(id,true)).success,true);
 let phone=(await action.getAdminPhones()).phones.find(phone=>phone.id===id);
 assert.equal(phone.removed,true);assert.equal(phone.booked,false);assert.equal(phone.published,true);
 assert.equal((await action.removeInventoryPhone(id,false)).success,true);
 phone=(await action.getAdminPhones()).phones.find(phone=>phone.id===id);
 assert.equal(phone.removed,false);assert.equal(phone.name,uploaded.name);assert.equal(phone.description,uploaded.description);
 assert.equal(phone.booked,false);assert.equal(phone.published,true);
 assert.equal(uploaded.is_published,true);
});
test('editing, removal and restoration preserve phone data and booking state',async()=>{
 const action=setup();
 assert.equal((await action.editInventoryPhone('iphone-13',details())).success,true);
 assert.equal((await action.setPhoneBooked('iphone-13',true)).success,true);
 assert.equal((await action.removeInventoryPhone('iphone-13',true)).success,true);
 let phone=(await action.getAdminPhones()).phones.find(phone=>phone.id==='iphone-13');
 assert.equal(phone.name,'Edited iPhone');assert.equal(phone.price,390000);assert.equal(phone.removed,true);assert.equal(phone.booked,true);
 assert.equal((await action.removeInventoryPhone('iphone-13',false)).success,true);
 phone=(await action.getAdminPhones()).phones.find(phone=>phone.id==='iphone-13');
 assert.equal(phone.removed,false);assert.equal(phone.booked,true);assert.equal(phone.price,390000);
});
test('invalid phone details and unknown identifiers do not write inventory',async()=>{
 const action=setup();const form=details();form.set('price','-1');
 assert.ok((await action.editInventoryPhone('iphone-13',form)).error);
 assert.ok((await action.removeInventoryPhone('not-a-phone',true)).error);
 assert.equal(action.states.size,0);
});
