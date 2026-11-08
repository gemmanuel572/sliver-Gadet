-- Run after repair.sql, or use the updated repair.sql which includes this migration.
-- Add metadata without replacing any existing inspection results.
begin;
alter table public.phone_condition_reports add column if not exists field_labels jsonb not null default '{}'::jsonb;
alter table public.phone_condition_reports add column if not exists removed_fields text[] not null default '{}';

-- Invoker security preserves the existing admin-only INSERT/UPDATE RLS policies.
-- A row lock makes changes to different fields atomic instead of overwriting the report.
create or replace function public.manage_phone_inspection_field(
  phone_id text, field_key text, field_label text, field_value text, field_operation text
) returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.silva_is_admin() then raise exception 'Administrator access is required' using errcode='42501'; end if;
  if field_key is null or field_key !~ '^[a-zA-Z][a-zA-Z0-9_-]{0,63}$'
    or field_key in ('__proto__','prototype','constructor')
    or field_label is null or length(trim(field_label)) not between 1 and 80
    or field_value is null or length(field_value)>160
    or field_operation is null or field_operation not in ('save','clear','remove') then
    raise exception 'Invalid inspection field';
  end if;
  -- Existing original catalogue IDs and published uploads are the only valid products.
  if not (phone_id in ('iphone-15-pro-max','iphone-14-pro','samsung-s24-ultra','iphone-13')
    or exists(select 1 from public.phone_uploads where id::text=phone_id and is_published))
    or exists(select 1 from public.phone_availability where product_id=phone_id and (booked or is_removed)) then
    raise exception 'Phone is not currently published';
  end if;
  insert into public.phone_condition_reports(product_id,conditions) values(phone_id,'{}') on conflict(product_id) do nothing;
  perform 1 from public.phone_condition_reports where product_id=phone_id for update;
  if field_operation='remove' then
    -- Keep the stored result for data preservation; the field is hidden only for this phone.
    update public.phone_condition_reports set removed_fields=array_append(array_remove(removed_fields,field_key),field_key)
    where product_id=phone_id;
  else
    update public.phone_condition_reports
    set conditions=jsonb_set(conditions,array[field_key],to_jsonb(case when field_operation='clear' or trim(field_value)='' then 'Not yet verified' else trim(field_value) end),true),
      field_labels=jsonb_set(field_labels,array[field_key],to_jsonb(trim(field_label)),true),
      removed_fields=array_remove(removed_fields,field_key)
    where product_id=phone_id;
  end if;
end;
$$;
revoke all on function public.manage_phone_inspection_field(text,text,text,text,text) from public,anon;
grant execute on function public.manage_phone_inspection_field(text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
