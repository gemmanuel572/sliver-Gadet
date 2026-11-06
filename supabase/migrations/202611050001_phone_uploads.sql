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
