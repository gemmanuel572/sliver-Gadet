-- Run after 202611050001_phone_uploads.sql.
begin;
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
commit;
