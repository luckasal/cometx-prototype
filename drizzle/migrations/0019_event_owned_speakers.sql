-- Inline event speakers belong to one event. Existing shared profiles remain global.
alter table public.speakers
  add column event_id uuid references public.events(id) on delete cascade;

create index speakers_event_id_idx on public.speakers(event_id);
