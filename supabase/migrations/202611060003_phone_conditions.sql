-- Run after the previous phone upload and availability migrations.
begin;
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
commit;
