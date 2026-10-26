-- Existing columns hold Czech copy. English remains optional for older records.
alter table public.articles
  add column if not exists title_en text,
  add column if not exists excerpt_en text,
  add column if not exists body_en text;

alter table public.content_entries
  add column if not exists title_en text,
  add column if not exists summary_en text,
  add column if not exists body_en text;

alter table public.membership_plans
  add column if not exists name_en text,
  add column if not exists description_en text;
