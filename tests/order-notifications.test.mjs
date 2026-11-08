import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup({user=true,admin=true,failPage=-1,count=0}={}) {
 const calls=[];
 const rows=Array.from({length:count},(_,i)=>({id:`order-${i}`,kind:i%2?'request':'product'}));
 const client={auth:{getUser:async()=>({data:{user:user?{id:'admin'}:null}})},from(table){
  if(table==='admin_users')return{select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{user_id:'admin'}:null})})})};
  const chain={select(columns){assert.equal(columns,'id,kind');return chain;},eq(column,value){assert.equal(column,'status');assert.equal(value,'pending');return chain;},order(){return chain;},async range(start,end){calls.push([start,end]);return start===failPage?{error:{code:'42501'}}:{data:rows.slice(start,end+1)};}};
  return chain;
 }};
 const exports={};
 const source=ts.transpileModule(readFileSync(new URL('../src/app/admin/notification-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:()=>({createClient:async()=>client})});
 return{...exports,calls};
}
test('notifications deny anonymous and non-admin users before reading orders',async()=>{
 for(const options of [{user:false},{admin:false}]){
  const action=setup(options);assert.ok((await action.getOrderNotifications()).error);assert.equal(action.calls.length,0);
 }
});
test('notification retrieval includes every pending-order page and minimal metadata',async()=>{
 const action=setup({count:1201});const result=await action.getOrderNotifications();
 assert.equal(result.notifications.length,1201);assert.equal(action.calls.length,3);
 assert.deepEqual(Object.keys(result.notifications[0]),['id','kind']);
 assert.equal(result.notifications.filter(item=>item.kind==='request').length,600);
});
test('a later page failure does not return a misleading partial count',async()=>{
 const result=await setup({count:1201,failPage:500}).getOrderNotifications();
 assert.ok(result.error);assert.equal(result.notifications,undefined);
});
test('an empty successful query represents no pending notifications',async()=>{
 const result=await setup().getOrderNotifications();assert.equal(result.notifications.length,0);assert.equal(result.error,undefined);
});
