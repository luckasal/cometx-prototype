-- Existing fields remain the Czech source of truth. English copy is optional
-- so older published events keep rendering until an editor supplies it.
alter table public.events
  add column if not exists title_en text,
  add column if not exists short_description_en text,
  add column if not exists description_en text,
  add column if not exists venue_en text,
  add column if not exists address_en text;

alter table public.ticket_types
  add column if not exists name_en text,
  add column if not exists description_en text;

alter table public.workshops
  add column if not exists title_en text,
  add column if not exists description_en text,
  add column if not exists location_en text;
