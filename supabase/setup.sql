-- ONE-TIME SETUP for a project that has not run the migrations.
-- Requires the existing public.admin_users table and your admin membership.
-- Run this entire file in the Supabase SQL editor. Do not run again after success.
-- Creates phone, inspection, inventory and order tables.
-- The customer count uses Supabase Auth directly and needs no SQL setup.

begin;

-- 202611050001_phone_uploads.sql
-- Run once in the Supabase SQL editor for this project.
create table if not exists public.phone_uploads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  photo_paths text[] not null check (cardinality(photo_paths) between 1 and 6),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.phone_uploads enable row level security;
grant select, insert on public.phone_uploads to authenticated;

create policy "Admins can read phone uploads" on public.phone_uploads
for select to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
create policy "Admins can create phone uploads" on public.phone_uploads
for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('phone-photos', 'phone-photos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Admins can upload phone photos" on storage.objects
for insert to authenticated with check (
  bucket_id = 'phone-photos' and
  (storage.foldername(name))[1] = (select auth.uid())::text and
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
create policy "Admins can read phone photos" on storage.objects
for select to authenticated using (
  bucket_id = 'phone-photos' and
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
create policy "Admins can remove own phone photos" on storage.objects
for delete to authenticated using (
  bucket_id = 'phone-photos' and
  (storage.foldername(name))[1] = (select auth.uid())::text and
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

-- 202611060001_publish_phones.sql
-- Run after 202611050001_phone_uploads.sql.
alter table public.phone_uploads
  add column brand text not null default '',
  add column price numeric(12,2),
  add column description text not null default '',
  add column colors text[] not null default '{}',
  add column storage text[] not null default '{}',
  add column is_published boolean not null default false;

-- Previous uploads stay unpublished until their store details are supplied.
alter table public.phone_uploads add constraint published_phone_details check (
  not is_published or (
    length(trim(brand)) between 1 and 80 and price is not null and price > 0
    and cardinality(colors) between 1 and 30 and cardinality(storage) between 1 and 30
  )
);
grant select (id, name, brand, price, description, colors, storage, photo_paths, created_at, is_published)
  on public.phone_uploads to anon;
create policy "Visitors can read published phones" on public.phone_uploads
for select to anon, authenticated using (is_published);

-- Keep the bucket private. Visitors can obtain signed URLs only for published photos.
create policy "Visitors can read published phone photos" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'phone-photos' and exists (
    select 1 from public.phone_uploads
    where is_published and storage.objects.name = any(photo_paths)
  )
);

-- 202611060002_booked_phones.sql
-- Run after 202611060001_publish_phones.sql.
create table public.phone_availability (
  product_id text primary key,
  booked boolean not null default false
);
alter table public.phone_availability enable row level security;
grant select on public.phone_availability to anon, authenticated;
grant insert, update on public.phone_availability to authenticated;
create policy "Visitors can read phone availability" on public.phone_availability
for select to anon, authenticated using (true);
create policy "Admins can set phone availability" on public.phone_availability
for insert to authenticated with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
create policy "Admins can update phone availability" on public.phone_availability
for update to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

drop policy "Visitors can read published phones" on public.phone_uploads;
create policy "Visitors can read published phones" on public.phone_uploads
for select to anon, authenticated using (
  is_published and not exists (
    select 1 from public.phone_availability where product_id = phone_uploads.id::text and booked
  )
);
drop policy "Visitors can read published phone photos" on storage.objects;
create policy "Visitors can read published phone photos" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'phone-photos' and exists (
    select 1 from public.phone_uploads
    where is_published and storage.objects.name = any(photo_paths)
    and not exists (
      select 1 from public.phone_availability where product_id = phone_uploads.id::text and booked
    )
  )
);

-- 202611060003_phone_conditions.sql
-- Run after the previous phone upload and availability migrations.
create table public.phone_condition_reports (
  product_id text primary key,
  conditions jsonb not null check (jsonb_typeof(conditions) = 'object')
);
alter table public.phone_condition_reports enable row level security;
grant select on public.phone_condition_reports to anon, authenticated;
grant insert, update on public.phone_condition_reports to authenticated;
create policy "Visitors can read phone inspection reports" on public.phone_condition_reports
for select to anon, authenticated using (true);
create policy "Admins can create phone inspection reports" on public.phone_condition_reports
for insert to authenticated with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
create policy "Admins can update phone inspection reports" on public.phone_condition_reports
for update to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

-- 202611060004_customer_orders.sql
-- Run after all previous migrations.
create table public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  customer_id uuid not null references auth.users(id),
  customer_email text not null default '',
  product_id text,
  kind text not null check (kind in ('product', 'request')),
  phone_name text not null check (length(trim(phone_name)) between 1 and 120),
  listed_price numeric(12,2),
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'awaiting_confirmation', 'completed')),
  created_at timestamptz not null default now(),
  unique (customer_id, request_id),
  check ((kind = 'product' and product_id is not null) or (kind = 'request' and product_id is null))
);
create index customer_orders_customer_created on public.customer_orders (customer_id, created_at desc);
create index customer_orders_status on public.customer_orders (status);
alter table public.customer_orders enable row level security;
grant select, insert on public.customer_orders to authenticated;
grant update (status) on public.customer_orders to authenticated;

create policy "Customers can read own orders and admins can read all" on public.customer_orders
for select to authenticated using (
  customer_id = (select auth.uid()) or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
create policy "Customers can place own pending orders" on public.customer_orders
for insert to authenticated with check (customer_id = (select auth.uid()) and status = 'pending');
create policy "Customers can verify their delivered orders" on public.customer_orders
for update to authenticated using (customer_id = (select auth.uid()) and status = 'awaiting_confirmation')
with check (customer_id = (select auth.uid()) and status = 'completed');
create policy "Admins can update order status" on public.customer_orders
for update to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

create table public.request_publications (
  order_id uuid primary key references public.customer_orders(id),
  product_id uuid references public.phone_uploads(id)
);
alter table public.request_publications enable row level security;
grant select, insert, update on public.request_publications to authenticated;
create policy "Customers and admins can read request availability" on public.request_publications
for select to authenticated using (
  exists (select 1 from public.customer_orders where id = order_id)
);
create policy "Admins can mark requests available" on public.request_publications
for insert to authenticated with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
create policy "Admins can link request uploads" on public.request_publications
for update to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

-- Create a requested phone and link it to its request in the same transaction.
create function public.publish_requested_phone(request_order_id uuid, phone_data jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  linked_id uuid;
  new_id uuid;
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access is required';
  end if;
  perform 1 from public.customer_orders
  where id = request_order_id and kind = 'request' and status in ('pending', 'processing') for update;
  if not found then raise exception 'Request is no longer waiting for a phone'; end if;
  select product_id into linked_id from public.request_publications where order_id = request_order_id for update;
  if not found then raise exception 'Mark the requested phone as available first'; end if;
  if linked_id is not null then raise exception 'This request already has an uploaded phone'; end if;
  insert into public.phone_uploads (name, brand, price, description, colors, storage, photo_paths, uploaded_by, is_published)
  values (phone_data->>'name', phone_data->>'brand', (phone_data->>'price')::numeric,
    coalesce(phone_data->>'description', ''),
    array(select jsonb_array_elements_text(phone_data->'colors')),
    array(select jsonb_array_elements_text(phone_data->'storage')),
    array(select jsonb_array_elements_text(phone_data->'photo_paths')),
    (select auth.uid()), true) returning id into new_id;
  update public.request_publications set product_id = new_id where order_id = request_order_id;
  return new_id;
end;
$$;
revoke all on function public.publish_requested_phone(uuid, jsonb) from public, anon;
grant execute on function public.publish_requested_phone(uuid, jsonb) to authenticated;

-- Confirming a booking/delivery and hiding its listing must succeed together.
create function public.advance_customer_order(order_id uuid, next_status text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  changed_id uuid;
  phone_id text;
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access is required';
  end if;
  if next_status not in ('processing', 'awaiting_confirmation') then
    raise exception 'Invalid order status';
  end if;
  update public.customer_orders set status = next_status
  where id = order_id and (
    (next_status = 'processing' and status = 'pending') or
    (next_status = 'awaiting_confirmation' and status in ('pending', 'processing'))
  ) returning id, product_id into changed_id, phone_id;
  if changed_id is null then raise exception 'Order is no longer awaiting this action'; end if;
  if phone_id is null then
    select product_id::text into phone_id from public.request_publications where request_publications.order_id = advance_customer_order.order_id;
  end if;
  if phone_id is not null then
    insert into public.phone_availability (product_id, booked) values (phone_id, true)
    on conflict (product_id) do update set booked = true;
  end if;
  return changed_id;
end;
$$;
revoke all on function public.advance_customer_order(uuid, text) from public, anon;
grant execute on function public.advance_customer_order(uuid, text) to authenticated;

commit;
