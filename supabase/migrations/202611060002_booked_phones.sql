-- Run after 202611060001_publish_phones.sql.
begin;
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
commit;
