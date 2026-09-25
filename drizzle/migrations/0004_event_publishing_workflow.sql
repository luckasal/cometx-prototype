-- Separate public visibility from an event's operational/registration state.
-- Keep the legacy status column synchronized for the existing registration RPCs.
create type public.event_publish_state as enum ('draft', 'published', 'unpublished');
create type public.event_operational_status as enum ('upcoming', 'registration_open', 'registration_closed', 'sold_out', 'completed', 'cancelled');

alter table public.events
  add column publish_state public.event_publish_state not null default 'draft',
  add column event_status public.event_operational_status not null default 'upcoming';

update public.events set
  publish_state = (case when status = 'draft' then 'draft' else 'published' end)::public.event_publish_state,
  event_status = (case status
    when 'registration_open' then 'registration_open'
    when 'sold_out' then 'sold_out'
    when 'completed' then 'completed'
    when 'cancelled' then 'cancelled'
    else 'upcoming'
  end)::public.event_operational_status;

create or replace function public.sync_legacy_event_status()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Existing seed scripts may still set the legacy status on insert.
  if tg_op = 'INSERT' and new.publish_state = 'draft' and new.event_status = 'upcoming' and new.status <> 'draft' then
    new.publish_state := 'published';
    new.event_status := case new.status
      when 'registration_open' then 'registration_open'::public.event_operational_status
      when 'sold_out' then 'sold_out'::public.event_operational_status
      when 'completed' then 'completed'::public.event_operational_status
      when 'cancelled' then 'cancelled'::public.event_operational_status
      else 'upcoming'::public.event_operational_status
    end;
  end if;

  new.status := case
    when new.publish_state <> 'published' then 'draft'::public.event_status
    when new.event_status = 'registration_open' then 'registration_open'::public.event_status
    when new.event_status = 'sold_out' then 'sold_out'::public.event_status
    when new.event_status = 'completed' then 'completed'::public.event_status
    when new.event_status = 'cancelled' then 'cancelled'::public.event_status
    else 'published'::public.event_status
  end;
  return new;
end $$;
create trigger events_sync_legacy_status
before insert or update of publish_state, event_status on public.events
for each row execute function public.sync_legacy_event_status();

drop policy "events public read" on public.events;
create policy "events public read" on public.events for select to anon, authenticated
  using (publish_state = 'published' or public.is_admin());
create index events_public_listing_idx on public.events (publish_state, event_status, start_date);
