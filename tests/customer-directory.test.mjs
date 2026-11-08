import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path,mocks={}){
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:name=>{if(!(name in mocks))throw new Error(name);return mocks[name];}});return exports;
}
const summaries=load('../src/lib/customer-directory.ts');
class SafeError extends Error{constructor(code,message){super(message);this.code=code;}}
const raw=(id,name,email)=>({id,email,created_at:'2026-11-06T10:00:00Z',user_metadata:{full_name:name,secret_token:'must-not-return'},app_metadata:{providers:['google']},identities:[{provider:'google',identity_data:{private:'hidden'}}]});
function directory(responses,total=3000){
 const calls=[];
 const client={auth:{admin:{listUsers:async params=>{calls.push(params);return responses[calls.length-1];},getUserById:async()=>({data:{user:raw('one','Name','one@example.com')}})}}};
 const helper=load('../src/lib/supabase/customer-directory.ts',{'server-only':{},'@/lib/customer-directory':summaries,'./admin':{createSupabaseAdminClient:()=>client,countRegisteredAuthUsers:async()=>total,CustomerCountError:SafeError}});
 return{...helper,calls};
}

test('normal customer browsing retrieves the requested Auth page, and returns only permitted fields',async()=>{
 const helper=directory([{data:{users:[raw('one','Google Name','name@example.com')]}}]);
 const result=await helper.readCustomerDirectory(2,'');
 assert.equal(helper.calls[0].page,2);assert.equal(helper.calls[0].perPage,25);assert.equal(result.total,3000);
 assert.equal(result.customers[0].name,'Google Name');
 assert.deepEqual(Object.keys(result.customers[0]).sort(),['email','id','name','providers','registeredAt']);
 assert.equal(JSON.stringify(result).includes('secret_token'),false);
});
test('global search scans beyond the first 1000 accounts and preserves exact totals',async()=>{
 const many=Array.from({length:1000},(_,i)=>raw(String(i),'Someone',`other${i}@example.com`));
 const helper=directory([{data:{users:many}},{data:{users:[raw('found','Needle Customer','found@example.com')]}}]);
 const result=await helper.readCustomerDirectory(1,'needle');
 assert.equal(helper.calls.length,2);assert.equal(result.total,1001);assert.equal(result.matching,1);assert.equal(result.customers[0].id,'found');
});
test('search is paginated after matching, including email matches',async()=>{
 const users=Array.from({length:32},(_,i)=>raw(String(i),'Person',`match${i}@example.com`));
 const result=await directory([{data:{users}}]).readCustomerDirectory(2,'match');
 assert.equal(result.matching,32);assert.equal(result.customers.length,7);assert.equal(result.customers[0].id,'25');
});
test('names are taken from Google metadata or the specified fallback',()=>{
 assert.equal(summaries.accountSummary(raw('id','', 'name@example.com')).name,'Name not provided');
 assert.equal(summaries.accountSummary({...raw('id','', 'name@example.com'),user_metadata:{name:'Google Alias'}}).name,'Google Alias');
});
test('partial search failures never return an incomplete customer list',async()=>{
 const many=Array.from({length:1000},(_,i)=>raw(String(i),'Person','person@example.com'));
 await assert.rejects(directory([{data:{users:many}},{error:new Error('API failed')}]).readCustomerDirectory(1,'person'));
});

const customerId='00000000-0000-4000-8000-000000000002';
function actions({admin=true,signedIn=true,missingOrders=false}={}){
 let authReads=0;const ownerFilters=[];
 const session={auth:{getUser:async()=>({data:{user:signedIn?{id:'admin-id'}:null}})},from:table=>{
  if(table==='admin_users')return{select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{user_id:'admin-id'}:null})})})};
  return{select:()=>({eq:(key,id)=>{ownerFilters.push([key,id]);return{order:()=>({range:async()=>missingOrders?{error:{code:'PGRST205'}}:{data:[{id:'order',phone_name:'Saved Phone',kind:'request',status:'pending',details:{quantity:2,address:'not-needed'},created_at:'2026-11-06'}]}})};}})};
 }};
 const result=load('../src/app/admin/customer-actions.ts',{
  '@/lib/supabase/server':{createClient:async()=>session},
  '@/lib/supabase/admin':{CustomerCountError:SafeError,countRegisteredAuthUsers:async()=>3},
  '@/lib/supabase/customer-directory':{readCustomerDirectory:async()=>{authReads++;return{customers:[],total:3,matching:3,page:1,perPage:25};},readCustomerAccount:async()=>{authReads++;return summaries.accountSummary(raw(customerId,'Name','name@example.com'));}},
  '@/lib/database-errors':load('../src/lib/database-errors.ts'),
 });
 return{...result,reads:()=>authReads,ownerFilters};
}
test('directory and customer detail server actions reject ordinary and unauthenticated users before private Auth reads',async()=>{
 for(const config of[{admin:false},{signedIn:false}]){
  const helper=actions(config);
  assert.ok((await helper.getCustomerDirectory()).error);assert.ok((await helper.getCustomerDetails(customerId)).error);assert.equal(helper.reads(),0);
 }
});
test('customer details query only the selected owner and sanitize order records',async()=>{
 const helper=actions();const result=await helper.getCustomerDetails(customerId);
 assert.deepEqual(helper.ownerFilters,[['customer_id',customerId]]);assert.equal(result.history.orders[0].kind,'request');
 assert.equal(JSON.stringify(result).includes('not-needed'),false);
});
test('missing orders retain genuine account information without fabricated empty history',async()=>{
 const result=await actions({missingOrders:true}).getCustomerDetails(customerId);
 assert.equal(result.customer.email,'name@example.com');assert.ok(result.historyError);assert.equal(result.history,undefined);
});
