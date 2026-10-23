-- Keep partner operational metadata private to Back Office reads. Public
-- partner queries explicitly select the public profile fields only.
alter table public.partners
  add column if not exists sector text,
  add column if not exists collaboration_start_date date,
  add column if not exists collaboration_end_date date;

-- Partner logos share the existing public event-media bucket, but uploads
-- are isolated by folder and staff capability. Public bucket reads are
-- intentional so partner logos can render on /partners.
create policy "partner staff upload CometX logos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'cometx-event-media'
  and (storage.foldername(name))[1] = 'partner-logos'
  and storage.extension(name) in ('jpg', 'png', 'webp')
  and exists (
    select 1 from public.user_roles as ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin', 'marketing')
  )
);
