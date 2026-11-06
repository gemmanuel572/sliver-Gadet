-- Run after all previous migrations.
begin;
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
