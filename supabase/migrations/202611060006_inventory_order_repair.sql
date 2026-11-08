-- REPEATABLE, DATA-PRESERVING REPAIR. Run the entire file in Supabase SQL Editor.
-- Does not delete rows, recreate tables, disable RLS, change Google Auth, or use API secrets.
-- Existing incompatible column types or duplicate identifiers require manual repair;
-- the transaction fails without deleting or guessing existing business data.
begin;
do $$ begin
  if to_regclass('public.admin_users') is null then
    raise exception 'Existing public.admin_users table is required; this script does not assign admin access';
  end if;
end $$;
create or replace function public.silva_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;
-- Membership is read by the existing dashboard/counter but managed only by the DB owner.
alter table public.admin_users enable row level security;
grant select on public.admin_users to authenticated;
revoke insert, update, delete on public.admin_users from public, anon, authenticated;
drop policy if exists silva_admin_self_read on public.admin_users;
create policy silva_admin_self_read on public.admin_users for select to authenticated using (user_id=auth.uid());
drop policy if exists silva_admin_self_boundary on public.admin_users;
create policy silva_admin_self_boundary on public.admin_users as restrictive for select to anon, authenticated using (user_id=auth.uid());
drop policy if exists silva_no_admin_self_assignment on public.admin_users;
create policy silva_no_admin_self_assignment on public.admin_users as restrictive for insert to anon, authenticated with check (false);
drop policy if exists silva_no_admin_update on public.admin_users;
create policy silva_no_admin_update on public.admin_users as restrictive for update to anon, authenticated using (false) with check (false);
drop policy if exists silva_no_admin_delete on public.admin_users;
create policy silva_no_admin_delete on public.admin_users as restrictive for delete to anon, authenticated using (false);
revoke all on function public.silva_is_admin() from public;
grant execute on function public.silva_is_admin() to anon, authenticated;
-- Run once in the Supabase SQL editor for this project.
create table if not exists public.phone_uploads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  photo_paths text[] not null check (cardinality(photo_paths) between 1 and 6),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.phone_uploads add column if not exists id uuid default gen_random_uuid();
alter table public.phone_uploads add column if not exists name text not null default '';
alter table public.phone_uploads add column if not exists brand text not null default '';
alter table public.phone_uploads add column if not exists price numeric(12,2);
alter table public.phone_uploads add column if not exists description text not null default '';
alter table public.phone_uploads add column if not exists colors text[] not null default '{}';
alter table public.phone_uploads add column if not exists storage text[] not null default '{}';
alter table public.phone_uploads add column if not exists photo_paths text[] not null default '{}';
alter table public.phone_uploads add column if not exists uploaded_by uuid references auth.users(id);
alter table public.phone_uploads add column if not exists created_at timestamptz not null default now();
alter table public.phone_uploads add column if not exists is_published boolean not null default false;
create unique index if not exists silva_phone_uploads_key on public.phone_uploads (id);

alter table public.phone_uploads enable row level security;
grant select, insert on public.phone_uploads to authenticated;

drop policy if exists "Admins can read phone uploads" on public.phone_uploads;
create policy "Admins can read phone uploads" on public.phone_uploads
for select to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
drop policy if exists "Admins can create phone uploads" on public.phone_uploads;
create policy "Admins can create phone uploads" on public.phone_uploads
for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('phone-photos', 'phone-photos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Admins can upload phone photos" on storage.objects;
create policy "Admins can upload phone photos" on storage.objects
for insert to authenticated with check (
  bucket_id = 'phone-photos' and
  (storage.foldername(name))[1] = (select auth.uid())::text and
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
drop policy if exists "Admins can read phone photos" on storage.objects;
create policy "Admins can read phone photos" on storage.objects
for select to authenticated using (
  bucket_id = 'phone-photos' and
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
drop policy if exists "Admins can remove own phone photos" on storage.objects;
create policy "Admins can remove own phone photos" on storage.objects
for delete to authenticated using (
  bucket_id = 'phone-photos' and
  (storage.foldername(name))[1] = (select auth.uid())::text and
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

-- Run after 202611050001_phone_uploads.sql.
alter table public.phone_uploads
  add column if not exists brand text not null default '',
  add column if not exists price numeric(12,2),
  add column if not exists description text not null default '',
  add column if not exists colors text[] not null default '{}',
  add column if not exists storage text[] not null default '{}',
  add column if not exists is_published boolean not null default false;

-- Previous uploads stay unpublished until their store details are supplied.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.phone_uploads'::regclass and conname='published_phone_details') then
    alter table public.phone_uploads add constraint published_phone_details check (
  not is_published or (
    length(trim(brand)) between 1 and 80 and price is not null and price > 0
    and cardinality(colors) between 1 and 30 and cardinality(storage) between 1 and 30
  )
    ) not valid;
  end if;
end $$;
grant select (id, name, brand, price, description, colors, storage, photo_paths, created_at, is_published)
  on public.phone_uploads to anon;
drop policy if exists "Visitors can read published phones" on public.phone_uploads;
create policy "Visitors can read published phones" on public.phone_uploads
for select to anon, authenticated using (is_published);

-- Keep the bucket private. Visitors can obtain signed URLs only for published photos.
drop policy if exists "Visitors can read published phone photos" on storage.objects;
create policy "Visitors can read published phone photos" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'phone-photos' and exists (
    select 1 from public.phone_uploads
    where is_published and storage.objects.name = any(photo_paths)
  )
);

-- Run after 202611060001_publish_phones.sql.
create table if not exists public.phone_availability (
  product_id text primary key,
  booked boolean not null default false
);
alter table public.phone_availability add column if not exists product_id text;
alter table public.phone_availability add column if not exists booked boolean not null default false;
alter table public.phone_availability add column if not exists is_removed boolean not null default false;
alter table public.phone_availability add column if not exists overrides jsonb not null default '{}'::jsonb;
create unique index if not exists silva_phone_availability_key on public.phone_availability (product_id);
alter table public.phone_availability enable row level security;
grant select on public.phone_availability to anon, authenticated;
grant insert, update on public.phone_availability to authenticated;
drop policy if exists "Visitors can read phone availability" on public.phone_availability;
create policy "Visitors can read phone availability" on public.phone_availability
for select to anon, authenticated using (true);
drop policy if exists "Admins can set phone availability" on public.phone_availability;
create policy "Admins can set phone availability" on public.phone_availability
for insert to authenticated with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
drop policy if exists "Admins can update phone availability" on public.phone_availability;
create policy "Admins can update phone availability" on public.phone_availability
for update to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

drop policy if exists "Visitors can read published phones" on public.phone_uploads;
drop policy if exists "Visitors can read published phones" on public.phone_uploads;
create policy "Visitors can read published phones" on public.phone_uploads
for select to anon, authenticated using (
  is_published and not exists (
    select 1 from public.phone_availability where product_id = phone_uploads.id::text and booked
  )
);
drop policy if exists "Visitors can read published phone photos" on storage.objects;
drop policy if exists "Visitors can read published phone photos" on storage.objects;
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

-- Run after the previous phone upload and availability migrations.
create table if not exists public.phone_condition_reports (
  product_id text primary key,
  conditions jsonb not null check (jsonb_typeof(conditions) = 'object')
);
alter table public.phone_condition_reports add column if not exists product_id text;
alter table public.phone_condition_reports add column if not exists conditions jsonb not null default '{}'::jsonb;
create unique index if not exists silva_phone_condition_reports_key on public.phone_condition_reports (product_id);
alter table public.phone_condition_reports enable row level security;
grant select on public.phone_condition_reports to anon, authenticated;
grant insert, update on public.phone_condition_reports to authenticated;
drop policy if exists "Visitors can read phone inspection reports" on public.phone_condition_reports;
create policy "Visitors can read phone inspection reports" on public.phone_condition_reports
for select to anon, authenticated using (true);
drop policy if exists "Admins can create phone inspection reports" on public.phone_condition_reports;
create policy "Admins can create phone inspection reports" on public.phone_condition_reports
for insert to authenticated with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
drop policy if exists "Admins can update phone inspection reports" on public.phone_condition_reports;
create policy "Admins can update phone inspection reports" on public.phone_condition_reports
for update to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

-- Run after all previous migrations.
create table if not exists public.customer_orders (
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
alter table public.customer_orders add column if not exists id uuid default gen_random_uuid();
alter table public.customer_orders add column if not exists request_id uuid;
alter table public.customer_orders add column if not exists customer_id uuid references auth.users(id);
alter table public.customer_orders add column if not exists customer_email text not null default '';
alter table public.customer_orders add column if not exists product_id text;
alter table public.customer_orders add column if not exists kind text not null default 'product';
alter table public.customer_orders add column if not exists phone_name text not null default '';
alter table public.customer_orders add column if not exists listed_price numeric(12,2);
alter table public.customer_orders add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.customer_orders add column if not exists status text not null default 'pending';
alter table public.customer_orders add column if not exists created_at timestamptz not null default now();
create unique index if not exists silva_customer_orders_key on public.customer_orders (id);
create unique index if not exists silva_order_retry_key on public.customer_orders (customer_id, request_id);
create index if not exists customer_orders_customer_created on public.customer_orders (customer_id, created_at desc);
create index if not exists customer_orders_status on public.customer_orders (status);
alter table public.customer_orders enable row level security;
grant select, insert on public.customer_orders to authenticated;
grant update (status) on public.customer_orders to authenticated;

drop policy if exists "Customers can read own orders and admins can read all" on public.customer_orders;
create policy "Customers can read own orders and admins can read all" on public.customer_orders
for select to authenticated using (
  customer_id = (select auth.uid()) or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
drop policy if exists "Customers can place own pending orders" on public.customer_orders;
create policy "Customers can place own pending orders" on public.customer_orders
for insert to authenticated with check (customer_id = (select auth.uid()) and status = 'pending');
drop policy if exists "Customers can verify their delivered orders" on public.customer_orders;
create policy "Customers can verify their delivered orders" on public.customer_orders
for update to authenticated using (customer_id = (select auth.uid()) and status = 'awaiting_confirmation')
with check (customer_id = (select auth.uid()) and status = 'completed');
drop policy if exists "Admins can update order status" on public.customer_orders;
create policy "Admins can update order status" on public.customer_orders
for update to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

create table if not exists public.request_publications (
  order_id uuid primary key references public.customer_orders(id),
  product_id uuid references public.phone_uploads(id)
);
alter table public.request_publications add column if not exists order_id uuid references public.customer_orders(id);
alter table public.request_publications add column if not exists product_id uuid references public.phone_uploads(id);
create unique index if not exists silva_request_publications_key on public.request_publications (order_id);
alter table public.request_publications enable row level security;
grant select, insert, update on public.request_publications to authenticated;
drop policy if exists "Customers and admins can read request availability" on public.request_publications;
create policy "Customers and admins can read request availability" on public.request_publications
for select to authenticated using (
  exists (select 1 from public.customer_orders where id = order_id)
);
drop policy if exists "Admins can mark requests available" on public.request_publications;
create policy "Admins can mark requests available" on public.request_publications
for insert to authenticated with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
drop policy if exists "Admins can link request uploads" on public.request_publications;
create policy "Admins can link request uploads" on public.request_publications
for update to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

-- Create a requested phone and link it to its request in the same transaction.
create or replace function public.publish_requested_phone(request_order_id uuid, phone_data jsonb)
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
create or replace function public.advance_customer_order(order_id uuid, next_status text)
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
-- Use private storage even if an earlier setup made this bucket public.
update storage.buckets set public=false where id='phone-photos';
-- Inventory removal is reversible and must never delete order history or photo files.
revoke delete on public.phone_uploads, public.phone_availability, public.phone_condition_reports,
  public.customer_orders, public.request_publications from public, anon, authenticated;
grant select, insert, update on public.phone_uploads, public.phone_availability,
  public.phone_condition_reports, public.request_publications to authenticated;
revoke all on public.customer_orders, public.request_publications from public, anon;
grant select, insert on public.customer_orders to authenticated;
-- Remove any older column UPDATE grants before allowing only status changes.
do $$ declare cols text; begin
  select string_agg(quote_ident(column_name), ',') into cols from information_schema.columns
  where table_schema='public' and table_name='customer_orders';
  execute 'revoke update (' || cols || ') on public.customer_orders from public, anon, authenticated';
end $$;
revoke update on public.customer_orders from public, anon, authenticated;
grant update(status) on public.customer_orders to authenticated;
create or replace function public.silva_guard_customer_order_update()
returns trigger language plpgsql set search_path='' as $$
begin
  if not public.silva_is_admin() and (
    old.customer_id is distinct from auth.uid() or old.status <> 'awaiting_confirmation'
    or new.status <> 'completed' or (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status')
  ) then raise exception 'Customers can only confirm receipt of their own delivered order' using errcode='42501'; end if;
  return new;
end;
$$;
drop trigger if exists silva_guard_customer_order_update on public.customer_orders;
create trigger silva_guard_customer_order_update before update on public.customer_orders
for each row execute function public.silva_guard_customer_order_update();
revoke all on function public.silva_guard_customer_order_update() from public, anon, authenticated;

drop policy if exists "silva_read_boundary" on public.phone_uploads;
create policy "silva_read_boundary" on public.phone_uploads as restrictive for select to anon, authenticated using ((public.silva_is_admin() or (is_published and not exists (select 1 from public.phone_availability state where state.product_id=phone_uploads.id::text and (state.booked or state.is_removed)))));

drop policy if exists "silva_allow_insert" on public.phone_uploads;
create policy "silva_allow_insert" on public.phone_uploads for insert to authenticated with check (public.silva_is_admin());

drop policy if exists "silva_allow_update" on public.phone_uploads;
create policy "silva_allow_update" on public.phone_uploads for update to authenticated using (public.silva_is_admin()) with check (public.silva_is_admin());

drop policy if exists "silva_guard_insert" on public.phone_uploads;
create policy "silva_guard_insert" on public.phone_uploads as restrictive for insert to anon, authenticated with check (public.silva_is_admin());

drop policy if exists "silva_guard_update" on public.phone_uploads;
create policy "silva_guard_update" on public.phone_uploads as restrictive for update to anon, authenticated using (public.silva_is_admin()) with check (public.silva_is_admin());

drop policy if exists "silva_no_hard_delete" on public.phone_uploads;
create policy "silva_no_hard_delete" on public.phone_uploads as restrictive for delete to anon, authenticated using (false);

drop policy if exists "silva_read_boundary" on public.phone_availability;
create policy "silva_read_boundary" on public.phone_availability as restrictive for select to anon, authenticated using (true);

drop policy if exists "silva_allow_insert" on public.phone_availability;
create policy "silva_allow_insert" on public.phone_availability for insert to authenticated with check (public.silva_is_admin());

drop policy if exists "silva_allow_update" on public.phone_availability;
create policy "silva_allow_update" on public.phone_availability for update to authenticated using (public.silva_is_admin()) with check (public.silva_is_admin());

drop policy if exists "silva_guard_insert" on public.phone_availability;
create policy "silva_guard_insert" on public.phone_availability as restrictive for insert to anon, authenticated with check (public.silva_is_admin());

drop policy if exists "silva_guard_update" on public.phone_availability;
create policy "silva_guard_update" on public.phone_availability as restrictive for update to anon, authenticated using (public.silva_is_admin()) with check (public.silva_is_admin());

drop policy if exists "silva_no_hard_delete" on public.phone_availability;
create policy "silva_no_hard_delete" on public.phone_availability as restrictive for delete to anon, authenticated using (false);

drop policy if exists "silva_read_boundary" on public.phone_condition_reports;
create policy "silva_read_boundary" on public.phone_condition_reports as restrictive for select to anon, authenticated using (true);

drop policy if exists "silva_allow_insert" on public.phone_condition_reports;
create policy "silva_allow_insert" on public.phone_condition_reports for insert to authenticated with check (public.silva_is_admin());

drop policy if exists "silva_allow_update" on public.phone_condition_reports;
create policy "silva_allow_update" on public.phone_condition_reports for update to authenticated using (public.silva_is_admin()) with check (public.silva_is_admin());

drop policy if exists "silva_guard_insert" on public.phone_condition_reports;
create policy "silva_guard_insert" on public.phone_condition_reports as restrictive for insert to anon, authenticated with check (public.silva_is_admin());

drop policy if exists "silva_guard_update" on public.phone_condition_reports;
create policy "silva_guard_update" on public.phone_condition_reports as restrictive for update to anon, authenticated using (public.silva_is_admin()) with check (public.silva_is_admin());

drop policy if exists "silva_no_hard_delete" on public.phone_condition_reports;
create policy "silva_no_hard_delete" on public.phone_condition_reports as restrictive for delete to anon, authenticated using (false);

drop policy if exists "silva_read_boundary" on public.customer_orders;
create policy "silva_read_boundary" on public.customer_orders as restrictive for select to anon, authenticated using ((customer_id=auth.uid() or public.silva_is_admin()));

drop policy if exists "silva_allow_insert" on public.customer_orders;
create policy "silva_allow_insert" on public.customer_orders for insert to authenticated with check (customer_id=auth.uid() and status='pending');

drop policy if exists "silva_allow_update" on public.customer_orders;
create policy "silva_allow_update" on public.customer_orders for update to authenticated using (public.silva_is_admin() or (customer_id=auth.uid() and status='awaiting_confirmation')) with check (public.silva_is_admin() or (customer_id=auth.uid() and status='completed'));

drop policy if exists "silva_guard_insert" on public.customer_orders;
create policy "silva_guard_insert" on public.customer_orders as restrictive for insert to anon, authenticated with check (customer_id=auth.uid() and status='pending');

drop policy if exists "silva_guard_update" on public.customer_orders;
create policy "silva_guard_update" on public.customer_orders as restrictive for update to anon, authenticated using (public.silva_is_admin() or (customer_id=auth.uid() and status='awaiting_confirmation')) with check (public.silva_is_admin() or (customer_id=auth.uid() and status='completed'));

drop policy if exists "silva_no_hard_delete" on public.customer_orders;
create policy "silva_no_hard_delete" on public.customer_orders as restrictive for delete to anon, authenticated using (false);

drop policy if exists "silva_read_boundary" on public.request_publications;
create policy "silva_read_boundary" on public.request_publications as restrictive for select to anon, authenticated using (exists (select 1 from public.customer_orders orders where orders.id=request_publications.order_id and (orders.customer_id=auth.uid() or public.silva_is_admin())));

drop policy if exists "silva_allow_insert" on public.request_publications;
create policy "silva_allow_insert" on public.request_publications for insert to authenticated with check (public.silva_is_admin());

drop policy if exists "silva_allow_update" on public.request_publications;
create policy "silva_allow_update" on public.request_publications for update to authenticated using (public.silva_is_admin()) with check (public.silva_is_admin());

drop policy if exists "silva_guard_insert" on public.request_publications;
create policy "silva_guard_insert" on public.request_publications as restrictive for insert to anon, authenticated with check (public.silva_is_admin());

drop policy if exists "silva_guard_update" on public.request_publications;
create policy "silva_guard_update" on public.request_publications as restrictive for update to anon, authenticated using (public.silva_is_admin()) with check (public.silva_is_admin());

drop policy if exists "silva_no_hard_delete" on public.request_publications;
create policy "silva_no_hard_delete" on public.request_publications as restrictive for delete to anon, authenticated using (false);

grant select on public.phone_availability, public.phone_condition_reports to anon;

drop policy if exists "Visitors can read published phones" on public.phone_uploads;
create policy "Visitors can read published phones" on public.phone_uploads for select to anon, authenticated using ((public.silva_is_admin() or (is_published and not exists (select 1 from public.phone_availability state where state.product_id=phone_uploads.id::text and (state.booked or state.is_removed)))));

drop policy if exists "silva_photo_read_boundary" on storage.objects;
create policy "silva_photo_read_boundary" on storage.objects as restrictive for select to anon, authenticated using (bucket_id <> 'phone-photos' or public.silva_is_admin() or exists (select 1 from public.phone_uploads phone where phone.is_published and storage.objects.name=any(phone.photo_paths) and not exists (select 1 from public.phone_availability state where state.product_id=phone.id::text and (state.booked or state.is_removed))));

drop policy if exists "silva_photo_insert_boundary" on storage.objects;
create policy "silva_photo_insert_boundary" on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> 'phone-photos' or (public.silva_is_admin() and (storage.foldername(name))[1]=auth.uid()::text));

drop policy if exists "silva_photo_update_boundary" on storage.objects;
create policy "silva_photo_update_boundary" on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'phone-photos' or (public.silva_is_admin() and (storage.foldername(name))[1]=auth.uid()::text)) with check (bucket_id <> 'phone-photos' or (public.silva_is_admin() and (storage.foldername(name))[1]=auth.uid()::text));

drop policy if exists "silva_photo_delete_boundary" on storage.objects;
create policy "silva_photo_delete_boundary" on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'phone-photos' or (public.silva_is_admin() and (storage.foldername(name))[1]=auth.uid()::text));

notify pgrst, 'reload schema';
commit;
