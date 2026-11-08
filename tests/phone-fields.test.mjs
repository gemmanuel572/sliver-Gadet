import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,mocks={}){
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(source,{exports,require:name=>{
  if(name in mocks)return mocks[name];
  const files={'@/data/products':'../src/data/products.ts','@/lib/phone-conditions':'../src/lib/phone-conditions.ts','@/lib/inventory':'../src/lib/inventory.ts','@/lib/database-errors':'../src/lib/database-errors.ts'};
  if(files[name])return load(files[name]);throw new Error(name);
 },console,File,crypto});return exports;
}
const active='10000000-0000-4000-8000-000000000001';
const draft='10000000-0000-4000-8000-000000000002';
const removed='10000000-0000-4000-8000-000000000003';
const booked='10000000-0000-4000-8000-000000000004';
function setup(admin=true){
 const rpc=[];
 const uploads=[active,draft,removed,booked].map(id=>({id,name:'Uploaded Samsung',brand:'Samsung',price:100000,description:'Phone',colors:['Black'],storage:['128GB'],photo_paths:['photo.jpg'],is_published:id!==draft}));
 const states=[{product_id:removed,is_removed:true},{product_id:booked,booked:true},{product_id:'iphone-13',is_removed:true},{product_id:'iphone-14-pro',booked:true}];
 const reports=[{product_id:'samsung-s24-ultra',conditions:{batteryHealth:'95%',screen:'Working',custom_glass:'Small chip',trueTone:'Not applicable'},field_labels:{custom_glass:'Back Glass'},removed_fields:['screen']}];
 const db={auth:{getUser:async()=>({data:{user:{id:'admin-id'}}})},from:table=>{
  if(table==='admin_users')return{select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{user_id:'admin-id'}:null})})})};
  if(table==='phone_availability')return{select:async()=>({data:states})};
  if(table==='phone_condition_reports')return{select:async()=>({data:reports})};
  if(table==='phone_uploads')return{select:()=>({order:async()=>({data:uploads}),eq:()=>({order:async()=>({data:uploads.filter(phone=>phone.is_published)})})})};
  throw new Error('A request was incorrectly treated as a catalogue product: '+table);
 },rpc:async(name,args)=>{rpc.push({name,args});return{};},storage:{from:()=>({createSignedUrls:async()=>({data:[{signedUrl:'https://example.com/photo.jpg'}]})})}};
 const mocks={'@/lib/supabase/server':{createClient:async()=>db}};
 return{...load('../src/app/admin/actions.ts',mocks),GET:load('../src/app/api/products/route.ts',{...mocks,'next/server':{NextResponse:{json:body=>body}}}).GET,rpc};
}
test('the condition editor and homepage expose the same active published phone IDs',async()=>{
 const action=setup();const editor=await action.getAdminConditionPhones();const publicCatalogue=await action.GET();
 assert.deepEqual(Array.from(editor.phones,phone=>phone.id).sort(),Array.from(publicCatalogue.products,phone=>phone.id).sort());
 assert.ok(editor.phones.some(phone=>phone.id===active));
 for(const id of[draft,removed,booked,'iphone-13','iphone-14-pro'])assert.equal(editor.phones.some(phone=>phone.id===id),false);
});
test('custom results, labels and per-phone field removal reach customer reports',async()=>{
 const catalogue=await setup().GET();
 const samsung=catalogue.products.find(phone=>phone.id==='samsung-s24-ultra');
 assert.equal(samsung.conditions.trueTone,undefined);assert.equal(samsung.conditions.screen,undefined);
 assert.equal(samsung.conditions.custom_glass,'Small chip');assert.equal(samsung.conditionLabels.custom_glass,'Back Glass');
 assert.equal(samsung.conditions.cameras,'Not yet verified');
 assert.equal(catalogue.products.find(phone=>phone.id==='iphone-15-pro-max').conditions.screen,'Not yet verified');
 assert.equal(catalogue.products.find(phone=>phone.id==='iphone-15-pro-max').conditions.trueTone,'Not yet verified');
});
test('individual field saves require admin access and an active published phone',async()=>{
 const ordinary=setup(false);assert.ok((await ordinary.saveInspectionField(active,'screen','Screen','Working','save')).error);assert.equal(ordinary.rpc.length,0);
 const action=setup();for(const id of[draft,removed,booked])assert.ok((await action.saveInspectionField(id,'screen','Screen','Working','save')).error);
 assert.equal(action.rpc.length,0);
 assert.equal((await action.saveInspectionField(active,'batteryHealth','Battery Health','94%','save')).success,true);
 assert.equal(action.rpc[0].name,'manage_phone_inspection_field');assert.equal(action.rpc[0].args.field_key,'batteryHealth');
 assert.ok((await action.saveInspectionField(active,'trueTone','True Tone','Working','save')).error);
});
test('cleared and renamed fields are saved individually with no global template mutation',async()=>{
 const action=setup();assert.equal((await action.saveInspectionField(active,'screen','Display','','clear')).success,true);
 assert.equal(action.rpc[0].args.field_value,'Not yet verified');assert.equal(action.rpc[0].args.field_label,'Display');
 const helpers=load('../src/lib/phone-conditions.ts');assert.equal(helpers.conditionLabels.screen,'Screen Condition');
 assert.equal(helpers.isReportVerified({batteryHealth:'94%'}),true);assert.equal(helpers.isReportVerified({}),false);
});
