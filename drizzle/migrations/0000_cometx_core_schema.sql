-- ============ ENUMS ============
create type public.app_role as enum ('user','admin');
create type public.membership_status as enum ('active','inactive','cancelled','past_due');
create type public.event_status as enum ('draft','published','registration_open','sold_out','completed','cancelled');
create type public.registration_status as enum ('pending','confirmed','cancelled','checked_in');
create type public.article_status as enum ('draft','published');
create type public.article_visibility as enum ('public','registered','members','entitlement');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  phone text,
  company text,
  job_title text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ USER ROLES (authoritative role store) ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- auto-create profile + default role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ============ MEMBERSHIP PLANS / ENTITLEMENTS ============
create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  annual_price numeric(10,2) not null default 0,
  currency text not null default 'CHF',
  active boolean not null default true,
  sort_order int not null default 0,
  stripe_price_id text,
  created_at timestamptz not null default now()
);
grant select on public.membership_plans to anon, authenticated;
grant all on public.membership_plans to service_role;
alter table public.membership_plans enable row level security;
create policy "plans public read" on public.membership_plans for select to anon, authenticated using (active or public.is_admin());
create policy "plans admin write" on public.membership_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
grant select on public.entitlements to anon, authenticated;
grant all on public.entitlements to service_role;
alter table public.entitlements enable row level security;
create policy "entitlements public read" on public.entitlements for select to anon, authenticated using (true);
create policy "entitlements admin write" on public.entitlements for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  membership_plan_id uuid not null references public.membership_plans(id) on delete cascade,
  entitlement_id uuid not null references public.entitlements(id) on delete cascade,
  value numeric(10,2),
  unique (membership_plan_id, entitlement_id)
);
grant select on public.plan_entitlements to anon, authenticated;
grant all on public.plan_entitlements to service_role;
alter table public.plan_entitlements enable row level security;
create policy "plan_entitlements public read" on public.plan_entitlements for select to anon, authenticated using (true);
create policy "plan_entitlements admin write" on public.plan_entitlements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ MEMBERSHIPS ============
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_plan_id uuid not null references public.membership_plans(id),
  status public.membership_status not null default 'inactive',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memberships_user_idx on public.memberships(user_id);
grant select on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;
create policy "own memberships read" on public.memberships for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "memberships admin write" on public.memberships for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger memberships_touch before update on public.memberships for each row execute function public.touch_updated_at();

-- ============ SPEAKERS ============
create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  photo_url text,
  job_title text,
  company text,
  bio text,
  linkedin_url text,
  website_url text,
  created_at timestamptz not null default now()
);
grant select on public.speakers to anon, authenticated;
grant all on public.speakers to service_role;
alter table public.speakers enable row level security;
create policy "speakers public read" on public.speakers for select to anon, authenticated using (true);
create policy "speakers admin write" on public.speakers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ PARTNERS ============
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text,
  description text,
  tier text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.partners to anon, authenticated;
grant all on public.partners to service_role;
alter table public.partners enable row level security;
create policy "partners public read" on public.partners for select to anon, authenticated using (active or public.is_admin());
create policy "partners admin write" on public.partners for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ EVENTS ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  short_description text,
  description text,
  hero_image_url text,
  start_date timestamptz not null,
  end_date timestamptz,
  venue text,
  address text,
  capacity int,
  registration_start timestamptz,
  registration_end timestamptz,
  status public.event_status not null default 'draft',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.events to anon, authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events public read" on public.events for select to anon, authenticated
  using (status in ('published','registration_open','sold_out','completed') or public.is_admin());
create policy "events admin write" on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();

create table public.event_speakers (
  event_id uuid not null references public.events(id) on delete cascade,
  speaker_id uuid not null references public.speakers(id) on delete cascade,
  sort_order int not null default 0,
  primary key (event_id, speaker_id)
);
grant select on public.event_speakers to anon, authenticated;
grant all on public.event_speakers to service_role;
alter table public.event_speakers enable row level security;
create policy "event_speakers public read" on public.event_speakers for select to anon, authenticated using (true);
create policy "event_speakers admin write" on public.event_speakers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.event_partners (
  event_id uuid not null references public.events(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  primary key (event_id, partner_id)
);
grant select on public.event_partners to anon, authenticated;
grant all on public.event_partners to service_role;
alter table public.event_partners enable row level security;
create policy "event_partners public read" on public.event_partners for select to anon, authenticated using (true);
create policy "event_partners admin write" on public.event_partners for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ WORKSHOPS ============
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  speaker_id uuid references public.speakers(id) on delete set null,
  title text not null,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  capacity int,
  base_price numeric(10,2) not null default 0,
  separate_registration_required boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.workshops to anon, authenticated;
grant all on public.workshops to service_role;
alter table public.workshops enable row level security;
create policy "workshops public read" on public.workshops for select to anon, authenticated using (true);
create policy "workshops admin write" on public.workshops for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ TICKET TYPES ============
create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  base_price numeric(10,2) not null default 0,
  currency text not null default 'CHF',
  capacity int,
  active boolean not null default true,
  required_entitlement text references public.entitlements(key),
  discount_entitlement text references public.entitlements(key),
  free_entitlement text references public.entitlements(key),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.ticket_types to anon, authenticated;
grant all on public.ticket_types to service_role;
alter table public.ticket_types enable row level security;
create policy "ticket_types public read" on public.ticket_types for select to anon, authenticated using (active or public.is_admin());
create policy "ticket_types admin write" on public.ticket_types for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ REGISTRATIONS ============
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  status public.registration_status not null default 'pending',
  price_paid numeric(10,2) not null default 0,
  currency text not null default 'CHF',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index registrations_unique_active on public.registrations(event_id, user_id)
  where status in ('pending','confirmed','checked_in');
grant select on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;
create policy "own registrations read" on public.registrations for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "registrations admin write" on public.registrations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger registrations_touch before update on public.registrations for each row execute function public.touch_updated_at();

-- ============ ARTICLES ============
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text,
  hero_image_url text,
  published_at timestamptz,
  status public.article_status not null default 'draft',
  visibility public.article_visibility not null default 'public',
  required_entitlement text references public.entitlements(key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.articles to anon, authenticated;
grant all on public.articles to service_role;
alter table public.articles enable row level security;
create policy "articles public read" on public.articles for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "articles admin write" on public.articles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger articles_touch before update on public.articles for each row execute function public.touch_updated_at();
