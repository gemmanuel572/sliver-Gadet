-- Read-only schema diagnosis. Retrieves no customer records or secrets.
with expected(table_name,column_name) as (values
('phone_uploads','id'),
('phone_uploads','name'),
('phone_uploads','brand'),
('phone_uploads','price'),
('phone_uploads','description'),
('phone_uploads','colors'),
('phone_uploads','storage'),
('phone_uploads','photo_paths'),
('phone_uploads','uploaded_by'),
('phone_uploads','created_at'),
('phone_uploads','is_published'),
('phone_availability','product_id'),
('phone_availability','booked'),
('phone_availability','is_removed'),
('phone_availability','overrides'),
('phone_condition_reports','product_id'),
('phone_condition_reports','conditions'),
('phone_condition_reports','field_labels'),
('phone_condition_reports','removed_fields'),
('customer_orders','id'),
('customer_orders','request_id'),
('customer_orders','customer_id'),
('customer_orders','customer_email'),
('customer_orders','product_id'),
('customer_orders','kind'),
('customer_orders','phone_name'),
('customer_orders','listed_price'),
('customer_orders','details'),
('customer_orders','status'),
('customer_orders','created_at'),
('request_publications','order_id'),
('request_publications','product_id')
)
select expected.table_name,expected.column_name,
  case when to_regclass('public.'||expected.table_name) is null then 'MISSING TABLE'
       when actual.column_name is null then 'MISSING COLUMN' else 'present' end as status,
  actual.data_type,actual.is_nullable
from expected left join information_schema.columns actual
  on actual.table_schema='public' and actual.table_name=expected.table_name and actual.column_name=expected.column_name
order by expected.table_name,expected.column_name;

select relname as table_name,relrowsecurity as rls_enabled
from pg_class join pg_namespace on pg_namespace.oid=relnamespace
where nspname='public' and relname in ('admin_users','phone_uploads','phone_availability','phone_condition_reports','customer_orders','request_publications');

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where (schemaname='public' and tablename in ('admin_users','phone_uploads','phone_availability','phone_condition_reports','customer_orders','request_publications'))
   or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;

select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('admin_users','phone_uploads','phone_availability','phone_condition_reports','customer_orders','request_publications')
  and grantee in ('anon','authenticated','PUBLIC') order by table_name,grantee,privilege_type;

select name,to_regprocedure(name) is not null as installed from (values
 ('public.silva_is_admin()'),('public.manage_phone_inspection_field(text,text,text,text,text)'),('public.publish_requested_phone(uuid,jsonb)'),('public.advance_customer_order(uuid,text)')) funcs(name);
