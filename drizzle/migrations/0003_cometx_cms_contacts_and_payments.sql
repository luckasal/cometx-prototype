-- CometX staff CMS: contacts remain distinct from authenticated members.
create type public.contact_status as enum ('subscribed', 'unsubscribed', 'pending');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'void');
create type public.content_type as enum ('video', 'gallery', 'opinion', 'open_position', 'symposium');

alter table public.events add column event_type text not null default 'event';
alter table public.events add column gallery_urls jsonb not null default '[]'::jsonb;
alter table public.events add constraint events_gallery_urls_array check (jsonb_typeof(gallery_urls) = 'array');

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  last_name text,
  phone text,
  company text,
  source text not null default 'manual' check (length(trim(source)) > 0),
  consent_at timestamptz,
  newsletter_status public.contact_status not null default 'pending',
  member_id uuid unique references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.contacts to service_role;
alter table public.contacts enable row level security;
create policy "contacts admin access" on public.contacts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger contacts_touch before update on public.contacts for each row execute function public.touch_updated_at();

create table public.content_entries (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  title text not null,
  slug text not null unique,
  summary text,
  body text,
  hero_image_url text,
  media_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(media_urls) = 'array'),
  status public.article_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_entries_type_idx on public.content_entries (content_type, status, published_at desc);
grant select on public.content_entries to anon, authenticated;
grant all on public.content_entries to service_role;
alter table public.content_entries enable row level security;
create policy "content entries public read" on public.content_entries for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "content entries admin write" on public.content_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger content_entries_touch before update on public.content_entries for each row execute function public.touch_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  registration_id uuid references public.registrations(id) on delete set null,
  membership_id uuid references public.memberships(id) on delete set null,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  currency text not null default 'CHF',
  status public.payment_status not null default 'pending',
  invoice_url text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "payments own or admin read" on public.payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "payments admin write" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

-- Preserve the existing test-mode Stripe fulfillment flow while populating the staff payment ledger.
create or replace function public.record_registration_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stripe_checkout_session_id is not null then
    insert into public.payments (
      user_id, registration_id, stripe_checkout_session_id, stripe_payment_intent_id,
      amount, currency, status
    ) values (
      new.user_id, new.id, new.stripe_checkout_session_id, new.stripe_payment_intent_id,
      new.price_paid, new.currency, 'paid'
    )
    on conflict (stripe_checkout_session_id) do update set
      registration_id = excluded.registration_id,
      stripe_payment_intent_id = excluded.stripe_payment_intent_id,
      amount = excluded.amount,
      currency = excluded.currency,
      status = excluded.status,
      updated_at = now();
  end if;
  return new;
end $$;
create trigger registrations_record_payment
after insert or update of stripe_checkout_session_id, stripe_payment_intent_id, price_paid, currency
on public.registrations for each row execute function public.record_registration_payment();

-- Newsletter endpoint uses SECURITY DEFINER so the public browser never receives write access.
create or replace function public.subscribe_newsletter(p_email text, p_first_name text default null, p_last_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare result_id uuid;
begin
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address';
  end if;
  insert into public.contacts (email, first_name, last_name, source, consent_at, newsletter_status)
  values (lower(trim(p_email)), nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''), 'newsletter', now(), 'subscribed')
  on conflict (email) do update set
    first_name = coalesce(excluded.first_name, contacts.first_name),
    last_name = coalesce(excluded.last_name, contacts.last_name),
    source = case when contacts.source = 'manual' then 'newsletter' else contacts.source end,
    consent_at = now(), newsletter_status = 'subscribed', updated_at = now()
  returning id into result_id;
  return result_id;
end $$;
revoke all on function public.subscribe_newsletter(text, text, text) from public;
grant execute on function public.subscribe_newsletter(text, text, text) to anon, authenticated;
