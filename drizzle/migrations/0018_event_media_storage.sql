-- Public event/speaker photographs. Only authenticated event staff can upload.
-- Apply together with the corresponding app release; do not expose other buckets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cometx-event-media',
  'cometx-event-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "event staff upload CometX images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'cometx-event-media'
  and (storage.foldername(name))[1] in ('event-heroes', 'event-gallery', 'speaker-photos')
  and exists (
    select 1 from public.user_roles as ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin', 'event_manager')
  )
);
