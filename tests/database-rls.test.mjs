import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const admin='00000000-0000-4000-8000-000000000001';
const alice='00000000-0000-4000-8000-000000000002';
const bob='00000000-0000-4000-8000-000000000003';
const phone='10000000-0000-4000-8000-000000000001';
const orderA='20000000-0000-4000-8000-000000000001';
const orderB='20000000-0000-4000-8000-000000000002';
const repair=readFileSync(new URL('../supabase/repair.sql',import.meta.url),'utf8');

test('repair SQL preserves data, is repeatable, and enforces real PostgreSQL RLS',async t=>{
 const db=new PGlite(); t.after(()=>db.close());
 await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema public,auth,storage to anon,authenticated;
  create table public.admin_users(user_id uuid primary key references auth.users(id));
  alter table public.admin_users enable row level security;
  grant select on public.admin_users to authenticated;
  create policy own_admin_membership on public.admin_users for select to authenticated using(user_id=auth.uid());
  grant insert on public.admin_users to authenticated;
  create policy legacy_bad_admin_assignment on public.admin_users for insert to authenticated with check(true);
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to anon,authenticated;
  create function storage.foldername(path text) returns text[] language sql immutable as $$ select (string_to_array(path,'/'))[1:array_length(string_to_array(path,'/'),1)-1] $$;
  insert into auth.users values('${admin}'),('${alice}'),('${bob}');
  insert into public.admin_users values('${admin}');
 `);
 await db.exec(repair);
 await db.exec(`insert into public.phone_uploads(id,name,brand,price,colors,storage,photo_paths,uploaded_by,is_published)
  values('${phone}','Test Phone','Apple',100000,array['Black'],array['128GB'],array['${admin}/phone.jpg'],'${admin}',true);
  insert into public.customer_orders(id,request_id,customer_id,kind,phone_name,details,product_id)
  values('${orderA}','${orderA}','${alice}','product','Test Phone','{"quantity":1}','${phone}'),
  ('${orderB}','${orderB}','${bob}','request','Requested Phone','{"quantity":1}',null);
  insert into public.request_publications(order_id) values('${orderB}');
  create policy legacy_broad_read on public.customer_orders for select to authenticated using(true);
 `);
 await db.exec(repair);
 const asUser=async id=>db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`);
 await t.test('rerunning the repair keeps existing inventory and orders',async()=>{
  assert.equal((await db.query('select count(*)::int as n from public.customer_orders')).rows[0].n,2);
  assert.equal((await db.query('select name from public.phone_uploads')).rows[0].name,'Test Phone');
 });
 await t.test('customers see only their own records despite a legacy broad policy',async()=>{
  await asUser(alice);
  assert.deepEqual((await db.query('select id from public.customer_orders')).rows.map(row=>row.id),[orderA]);
  assert.equal((await db.query('select * from public.request_publications')).rows.length,0);
  await asUser(bob);
  assert.deepEqual((await db.query('select id from public.customer_orders')).rows.map(row=>row.id),[orderB]);
  assert.equal((await db.query('select * from public.request_publications')).rows.length,1);
 });
 await t.test('customers cannot manage inventory, forge an owner or confirm an undelivered order',async()=>{
  await asUser(alice);
  await assert.rejects(db.exec(`insert into public.admin_users(user_id) values('${alice}')`));
  await assert.rejects(db.exec(`insert into public.phone_availability(product_id,booked) values('${phone}',true)`));
  await assert.rejects(db.exec(`insert into public.customer_orders(request_id,customer_id,kind,phone_name,details) values(gen_random_uuid(),'${bob}','request','Fake','{}')`));
  await db.exec(`update public.customer_orders set status='completed' where id='${orderA}'`);
  assert.equal((await db.query(`select status from public.customer_orders where id='${orderA}'`)).rows[0].status,'pending');
 });
 await t.test('admins see all orders and can edit, remove, restore and book inventory',async()=>{
  await asUser(admin);
  assert.equal((await db.query('select * from public.customer_orders')).rows.length,2);
  assert.equal((await db.query('select * from public.request_publications')).rows.length,1);
  await db.exec(`insert into public.phone_availability(product_id,overrides,is_removed) values('${phone}','{"name":"Edited Phone","price":90000}',true)`);
  assert.equal((await db.query('select is_removed from public.phone_availability')).rows[0].is_removed,true);
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); set role anon;`);
  assert.equal((await db.query('select id from public.phone_uploads')).rows.length,0);
  await asUser(admin);
  await db.exec(`update public.phone_availability set is_removed=false where product_id='${phone}'`);
  await db.query('select public.advance_customer_order($1,$2)',[orderA,'awaiting_confirmation']);
  assert.equal((await db.query('select booked from public.phone_availability')).rows[0].booked,true);
  assert.equal((await db.query('select count(*)::int as n from public.phone_uploads')).rows[0].n,1);
  await assert.rejects(db.exec(`delete from public.phone_uploads where id='${phone}'`));
 });
 await t.test('only the owner can verify a delivered order and its details stay immutable',async()=>{
  await asUser(bob);
  await db.exec(`update public.customer_orders set status='completed' where id='${orderA}'`);
  await asUser(alice);
  await assert.rejects(db.exec(`update public.customer_orders set customer_id='${bob}',status='completed' where id='${orderA}'`));
  await db.exec(`update public.customer_orders set status='completed' where id='${orderA}'`);
  assert.equal((await db.query(`select status from public.customer_orders where id='${orderA}'`)).rows[0].status,'completed');
 });
 await t.test('requested phones can be published atomically by admins but not customers',async()=>{
  const payload={name:'Sourced Phone',brand:'Apple',price:80000,description:'Sourced for customer',colors:['Black'],storage:['128GB'],photo_paths:[`${admin}/sourced.jpg`]};
  await asUser(alice);
  await assert.rejects(db.query('select public.publish_requested_phone($1,$2::jsonb)',[orderB,JSON.stringify(payload)]));
  await asUser(admin);
  const result=await db.query('select public.publish_requested_phone($1,$2::jsonb) as id',[orderB,JSON.stringify(payload)]);
  const id=result.rows[0].id;
  assert.ok(id);
  assert.equal((await db.query('select product_id from public.request_publications where order_id=$1',[orderB])).rows[0].product_id,id);
  assert.equal((await db.query('select name from public.phone_uploads where id=$1',[id])).rows[0].name,'Sourced Phone');
  await assert.rejects(db.query('select public.publish_requested_phone($1,$2::jsonb)',[orderB,JSON.stringify(payload)]));
  assert.equal((await db.query('select count(*)::int as n from public.phone_uploads')).rows[0].n,2);
 });
 await t.test('anonymous visitors cannot read private orders or request links',async()=>{
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); set role anon;`);
  await assert.rejects(db.query('select * from public.customer_orders'));
  await assert.rejects(db.query('select * from public.request_publications'));
 });
 await t.test('inspection fields save atomically, clear to unverified and are removed only for one phone',async()=>{
  const change=async(id,key,label,value,operation)=>db.query('select public.manage_phone_inspection_field($1,$2,$3,$4,$5)',[id,key,label,value,operation]);
  await asUser(alice);
  await assert.rejects(change('iphone-13','screen','Screen','Working','save'));
  await asUser(admin);
  await change('iphone-13','batteryHealth','Battery Health','91%','save');
  await change('iphone-13','screen','Screen Condition','Replaced — working','save');
  await change('iphone-14-pro','screen','Screen Condition','Original — working','save');
  let report=(await db.query("select * from public.phone_condition_reports where product_id='iphone-13'")).rows[0];
  assert.equal(report.conditions.batteryHealth,'91%');assert.equal(report.conditions.screen,'Replaced — working');
  await change('iphone-13','screen','Display','Ignored','clear');
  await change('iphone-13','custom_glass','Back Glass','No cracks','save');
  await change('iphone-13','screen','Display','Ignored','remove');
  report=(await db.query("select * from public.phone_condition_reports where product_id='iphone-13'")).rows[0];
  assert.ok(report.removed_fields.includes('screen'));assert.equal(report.conditions.screen,'Not yet verified');
  assert.equal(report.field_labels.custom_glass,'Back Glass');
  assert.equal((await db.query("select conditions from public.phone_condition_reports where product_id='iphone-14-pro'")).rows[0].conditions.screen,'Original — working');
  await change('iphone-13','screen','Display','Working — retested','save');
  assert.equal((await db.query("select removed_fields from public.phone_condition_reports where product_id='iphone-13'")).rows[0].removed_fields.includes('screen'),false);
  await db.exec("insert into public.phone_availability(product_id,is_removed) values('iphone-13',true)");
  await assert.rejects(change('iphone-13','screen','Display','Working','save'));
  await assert.rejects(change(orderB,'screen','Display','Working','save'));
  await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
  await db.exec(repair);
  assert.equal((await db.query("select conditions from public.phone_condition_reports where product_id='iphone-13'")).rows[0].conditions.custom_glass,'No cracks');
 });
});
