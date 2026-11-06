-- Can be run independently. Backfills existing accounts and tracks future signups.
begin;
create table public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
grant select on public.customer_profiles to authenticated;
create policy "Admins can read registered customers" on public.customer_profiles
for select to authenticated using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

create function public.sync_customer_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.customer_profiles (id, email, full_name, created_at)
  values (new.id, coalesce(new.email, ''),
    left(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'name', ''), 160), new.created_at)
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;
  return new;
end;
$$;
create trigger sync_registered_customer
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_customer_profile();
revoke all on function public.sync_customer_profile() from public, anon, authenticated;

insert into public.customer_profiles (id, email, full_name, created_at)
select id, coalesce(email, ''),
  left(coalesce(nullif(raw_user_meta_data->>'full_name', ''), raw_user_meta_data->>'name', ''), 160), created_at
from auth.users
on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;

-- The role check is inside the function as well as in the application.
-- Read-only access to private customer records is limited to verified admins.
create function public.registered_customer_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;
  if to_regclass('public.customer_orders') is null then
    select jsonb_build_object('metrics_available', false, 'customers', coalesce(jsonb_agg(
      jsonb_build_object('id', id, 'name', full_name, 'email', email, 'joinedAt', created_at,
        'phonesBought', 0, 'completedOrders', 0, 'totalOrders', 0)
      order by created_at desc, id), '[]'::jsonb)) into result from public.customer_profiles;
  else
    select jsonb_build_object('metrics_available', true, 'customers', coalesce(jsonb_agg(
      jsonb_build_object('id', profile.id, 'name', profile.full_name, 'email', profile.email, 'joinedAt', profile.created_at,
        'phonesBought', coalesce(purchases.phones_bought, 0), 'completedOrders', coalesce(purchases.completed_orders, 0),
        'totalOrders', coalesce(purchases.total_orders, 0))
      order by coalesce(purchases.phones_bought, 0) desc, coalesce(purchases.completed_orders, 0) desc, profile.created_at desc, profile.id
    ), '[]'::jsonb)) into result
    from public.customer_profiles profile
    left join (
      select customer_id, count(*) as total_orders,
        count(*) filter (where status = 'completed') as completed_orders,
        coalesce(sum(case when status = 'completed' and details->>'quantity' ~ '^[0-9]{1,5}$'
          then least((details->>'quantity')::integer, 10000) else 0 end), 0) as phones_bought
      from public.customer_orders group by customer_id
    ) purchases on purchases.customer_id = profile.id;
  end if;
  return result;
end;
$$;
revoke all on function public.registered_customer_summary() from public, anon;
grant execute on function public.registered_customer_summary() to authenticated;
commit;
