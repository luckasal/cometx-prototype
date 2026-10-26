-- Preserve existing Czech speaker copy while allowing an English version.
alter table public.speakers
  add column if not exists job_title_en text,
  add column if not exists bio_en text;
