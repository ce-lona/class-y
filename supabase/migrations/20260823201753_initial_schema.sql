-- Grunddatenmodell + Rollenmodell (siehe PLANNING.md Abschnitt 2-4)

-- ─────────────────────────────────────────────────────────────────
-- COMPANIES / STUDIOS
-- ─────────────────────────────────────────────────────────────────
create table companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  billing_address text,
  created_at      timestamptz not null default now()
);

create table studios (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name       text not null,
  address    text,
  created_at timestamptz not null default now()
);

create index studios_company_idx on studios (company_id);

-- ─────────────────────────────────────────────────────────────────
-- PROFILES (Stammdaten, trainer-editierbar, erweitert auth.users)
-- ─────────────────────────────────────────────────────────────────
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  phone           text,
  address         text,
  kleinunternehmer boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Jeder neue auth.users-Eintrag bekommt automatisch eine leere profiles-Zeile,
-- damit FKs (contracts, company_admins, ...) sofort greifen.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- COMPANY_ADMINS (Membership studio_admin, immer company-weit)
-- ─────────────────────────────────────────────────────────────────
create table company_admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (user_id, company_id)
);

-- ─────────────────────────────────────────────────────────────────
-- PLATFORM_ADMINS (globale Rolle, nicht in PLANNING.md Abschnitt 3
-- modelliert, aber für die RLS aus Abschnitt 4 nötig)
-- ─────────────────────────────────────────────────────────────────
create table platform_admins (
  user_id    uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────
-- CONTRACTS (Vertragsdaten, ausschließlich company_admin-editierbar)
-- ─────────────────────────────────────────────────────────────────
create table contracts (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid not null references profiles(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  employment_type text not null check (employment_type in ('freelancer', 'minijob', 'festangestellt')),
  rate_model      text not null check (rate_model in ('per_course', 'hourly', 'fixed')),
  rate_amount     numeric(10, 2) not null,
  valid_from      date not null,
  valid_to        date,
  status          text not null default 'active' check (status in ('active', 'ended')),
  created_at      timestamptz not null default now(),

  constraint contracts_valid_range check (valid_to is null or valid_to >= valid_from)
);

create index contracts_trainer_idx on contracts (trainer_id);
create index contracts_company_idx on contracts (company_id);

-- ─────────────────────────────────────────────────────────────────
-- COURSE_TYPES (pro Company frei definierbar)
-- ─────────────────────────────────────────────────────────────────
create table course_types (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  name                text not null,
  default_duration_min integer not null
);

-- ─────────────────────────────────────────────────────────────────
-- COURSE_PLANS (ein aktiver Plan pro Studio, Versionierung über
-- Archivieren + Neuanlage, siehe PLANNING.md Abschnitt 3)
-- ─────────────────────────────────────────────────────────────────
create table course_plans (
  id         uuid primary key default gen_random_uuid(),
  studio_id  uuid not null references studios(id) on delete cascade,
  valid_from date not null,
  valid_to   date,
  status     text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint course_plans_valid_range check (valid_to is null or valid_to >= valid_from)
);

-- Pro Studio darf zu jedem Zeitpunkt nur ein Plan aktiv sein
create unique index course_plans_one_active_per_studio
  on course_plans (studio_id)
  where status = 'active';

-- ─────────────────────────────────────────────────────────────────
-- COURSE_PLAN_SLOTS (Zeilen eines Plans / Wochenplan)
-- ─────────────────────────────────────────────────────────────────
create table course_plan_slots (
  id              uuid primary key default gen_random_uuid(),
  course_plan_id  uuid not null references course_plans(id) on delete cascade,
  weekday         smallint not null check (weekday between 1 and 7),
  start_time      time not null,
  end_time        time not null,
  course_type_id  uuid not null references course_types(id) on delete restrict,
  trainer_id      uuid not null references profiles(id) on delete restrict,

  constraint course_plan_slots_time_range check (end_time > start_time)
);

create index course_plan_slots_plan_idx on course_plan_slots (course_plan_id);
create index course_plan_slots_trainer_idx on course_plan_slots (trainer_id);

-- ─────────────────────────────────────────────────────────────────
-- COURSE_SESSIONS (tatsächlich getrackte Kurse, inkl. Ad-hoc und
-- spontane Vertretungen, ab Phase 1 explizit erlaubt)
-- ─────────────────────────────────────────────────────────────────
create table course_sessions (
  id                  uuid primary key default gen_random_uuid(),
  studio_id           uuid not null references studios(id) on delete cascade,
  course_plan_slot_id uuid references course_plan_slots(id) on delete set null,
  course_type_id      uuid references course_types(id) on delete set null,
  date                date not null,
  start_time          time not null,
  end_time            time not null,
  trainer_id          uuid not null references profiles(id) on delete restrict,
  is_substitution     boolean not null default false,
  status              text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  notes               text,
  logged_by           uuid references profiles(id) on delete set null,
  logged_at           timestamptz not null default now(),

  constraint course_sessions_time_range check (end_time > start_time),
  -- Ad-hoc-Kurse (ohne Plan-Slot) brauchen einen eigenen Kurstyp
  constraint course_sessions_type_or_slot check (course_plan_slot_id is not null or course_type_id is not null)
);

create index course_sessions_studio_date_idx on course_sessions (studio_id, date);
create index course_sessions_trainer_idx on course_sessions (trainer_id);

-- ─────────────────────────────────────────────────────────────────
-- RLS HELPER-FUNKTIONEN (security definer, um rekursive Policies auf
-- company_admins/platform_admins zu vermeiden)
-- ─────────────────────────────────────────────────────────────────
create or replace function is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from platform_admins where user_id = auth.uid()
  );
$$;

create or replace function is_company_admin(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from company_admins
    where user_id = auth.uid() and company_id = target_company_id
  );
$$;

create or replace function has_active_contract(target_trainer_id uuid, target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from contracts
    where trainer_id = target_trainer_id
      and company_id = target_company_id
      and status = 'active'
      and valid_from <= current_date
      and (valid_to is null or valid_to >= current_date)
  );
$$;

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (siehe PLANNING.md Abschnitt 4)
-- ─────────────────────────────────────────────────────────────────

-- COMPANIES: company_admin/platform_admin der jeweiligen Company; Trainer
-- sehen die Company nur indirekt über Studios/Contracts (kein direkter Zugriff).
alter table companies enable row level security;

create policy "companies: company_admin/platform_admin"
  on companies for all
  using (is_company_admin(id) or is_platform_admin())
  with check (is_company_admin(id) or is_platform_admin());

-- STUDIOS: company-weiter Zugriff für company_admin/platform_admin; Trainer
-- sehen Studios, an denen sie einen aktiven Contract mit der Company haben.
alter table studios enable row level security;

create policy "studios: company_admin/platform_admin"
  on studios for all
  using (is_company_admin(company_id) or is_platform_admin())
  with check (is_company_admin(company_id) or is_platform_admin());

create policy "studios: trainer mit aktivem contract"
  on studios for select
  using (has_active_contract(auth.uid(), company_id));

-- PROFILES: jede:r sieht/bearbeitet die eigene Zeile; company_admin sieht
-- (read-only) Trainer mit Contract in der eigenen Company; platform_admin alles.
alter table profiles enable row level security;

create policy "profiles: eigene Zeile"
  on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: company_admin sieht eigene Trainer"
  on profiles for select
  using (
    exists (
      select 1 from contracts
      where contracts.trainer_id = profiles.id
        and is_company_admin(contracts.company_id)
    )
  );

create policy "profiles: platform_admin"
  on profiles for select
  using (is_platform_admin());

-- COMPANY_ADMINS: eigene Mitgliedschaft sichtbar; platform_admin verwaltet alles.
alter table company_admins enable row level security;

create policy "company_admins: eigene Mitgliedschaft"
  on company_admins for select
  using (user_id = auth.uid());

create policy "company_admins: platform_admin"
  on company_admins for all
  using (is_platform_admin())
  with check (is_platform_admin());

-- PLATFORM_ADMINS: nur platform_admin selbst verwaltet diese Tabelle.
alter table platform_admins enable row level security;

create policy "platform_admins: platform_admin"
  on platform_admins for all
  using (is_platform_admin())
  with check (is_platform_admin());

-- CONTRACTS: trainer liest nur eigene Zeilen (read-only); company_admin/
-- platform_admin verwalten Contracts der eigenen Company vollständig.
alter table contracts enable row level security;

create policy "contracts: trainer liest eigene"
  on contracts for select
  using (trainer_id = auth.uid());

create policy "contracts: company_admin/platform_admin"
  on contracts for all
  using (is_company_admin(company_id) or is_platform_admin())
  with check (is_company_admin(company_id) or is_platform_admin());

-- COURSE_TYPES: company-weiter Zugriff für company_admin/platform_admin;
-- Trainer mit aktivem Contract dürfen die Kurstypen der Company lesen.
alter table course_types enable row level security;

create policy "course_types: company_admin/platform_admin"
  on course_types for all
  using (is_company_admin(company_id) or is_platform_admin())
  with check (is_company_admin(company_id) or is_platform_admin());

create policy "course_types: trainer mit aktivem contract"
  on course_types for select
  using (has_active_contract(auth.uid(), company_id));

-- COURSE_PLANS / COURSE_PLAN_SLOTS: company-weiter Zugriff für company_admin/
-- platform_admin; Trainer lesen Pläne der Studios ihrer aktiven Companies.
alter table course_plans enable row level security;

create policy "course_plans: company_admin/platform_admin"
  on course_plans for all
  using (
    is_platform_admin() or
    is_company_admin((select company_id from studios where studios.id = course_plans.studio_id))
  )
  with check (
    is_platform_admin() or
    is_company_admin((select company_id from studios where studios.id = course_plans.studio_id))
  );

create policy "course_plans: trainer mit aktivem contract"
  on course_plans for select
  using (
    has_active_contract(auth.uid(), (select company_id from studios where studios.id = course_plans.studio_id))
  );

alter table course_plan_slots enable row level security;

create policy "course_plan_slots: company_admin/platform_admin"
  on course_plan_slots for all
  using (
    is_platform_admin() or
    is_company_admin((
      select s.company_id from course_plans cp
      join studios s on s.id = cp.studio_id
      where cp.id = course_plan_slots.course_plan_id
    ))
  )
  with check (
    is_platform_admin() or
    is_company_admin((
      select s.company_id from course_plans cp
      join studios s on s.id = cp.studio_id
      where cp.id = course_plan_slots.course_plan_id
    ))
  );

create policy "course_plan_slots: trainer mit aktivem contract"
  on course_plan_slots for select
  using (
    has_active_contract(auth.uid(), (
      select s.company_id from course_plans cp
      join studios s on s.id = cp.studio_id
      where cp.id = course_plan_slots.course_plan_id
    ))
  );

-- COURSE_SESSIONS: Trainer sehen/erfassen eigene Sessions (auch Vertretungen
-- fremder Slots und Ad-hoc-Kurse), solange ein aktiver Contract mit der
-- Company des Studios besteht; company_admin/platform_admin company-weit.
alter table course_sessions enable row level security;

create policy "course_sessions: trainer eigene Zeilen"
  on course_sessions for all
  using (trainer_id = auth.uid())
  with check (
    trainer_id = auth.uid() and
    has_active_contract(auth.uid(), (select company_id from studios where studios.id = course_sessions.studio_id))
  );

create policy "course_sessions: company_admin/platform_admin"
  on course_sessions for all
  using (
    is_platform_admin() or
    is_company_admin((select company_id from studios where studios.id = course_sessions.studio_id))
  )
  with check (
    is_platform_admin() or
    is_company_admin((select company_id from studios where studios.id = course_sessions.studio_id))
  );
