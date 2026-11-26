-- Gutschriften für Freiberufler:innen und Tätigkeitsnachweise für Angestellte.
--
-- Überblick
--   * Vertragsannahme mit Stammdaten: accept_contract_with_master_data() speichert Name,
--     Anschrift, IBAN, Steuernummer/USt-IdNr. und (Freiberufler:innen) die Zustimmung zum
--     Gutschriftverfahren (§ 14 Abs. 2 S. 2 UStG). Danach bestätigt das Studio den Vertrag
--     (confirm_contract). Nur bestätigte Verträge zählen für die Abrechnung.
--   * Sensible Abrechnungsdaten (IBAN, Steuernummer) liegen in trainer_billing_details und sind
--     nur für die Person selbst lesbar. Studios sehen sie ausschließlich auf ausgestellten Belegen.
--   * company_billing_settings: je Company (nur Company-Admins ändern).
--   * billing_documents: unveränderliche Belege (Gutschrift, Stornogutschrift,
--     Tätigkeitsnachweis) mit eingefrorener Kopie (snapshot) aller Angaben und Kurszeilen.
--     Nur der Status wechselt. Korrektur = Stornogutschrift + neue Gutschrift; ein geänderter
--     Tätigkeitsnachweis wird als neue Version ausgestellt (alte Version: superseded).
--   * billing_comments: Korrekturwünsche (Gutschrift) und Kommentare (Nachweis), die
--     Admins/Koordinator:innen als erledigt markieren.
--   * Täglicher Job (pg_cron): Prüffrist abgelaufen → automatisch freigegeben; am Stichtag
--     automatische Erstellung für den Vormonat.
--
-- Rechte
--   * Erstellen: bei Abrechnung je Company nur Company-/Platform-Admins; bei Abrechnung je
--     Studio zusätzlich Koordinator:innen für ihre Studios.
--   * Company-Admins haben immer mindestens die Rechte von Koordinator:innen.

-- ─────────────────────────────────────────────────────────────────
-- SCHEMA
-- ─────────────────────────────────────────────────────────────────

-- Abrechnungsrelevante Stammdaten der Person ändern sich → Hinweis für das Studio.
alter table profiles add column master_data_updated_at timestamptz;

create table trainer_billing_details (
  user_id    uuid primary key references profiles(id) on delete cascade,
  tax_number text,
  vat_id     text,
  iban       text,
  updated_at timestamptz not null default now()
);

alter table trainer_billing_details enable row level security;

create policy "trainer_billing_details: eigene Zeile lesen"
  on trainer_billing_details for select
  using (user_id = auth.uid());

create policy "trainer_billing_details: eigene Zeile anlegen"
  on trainer_billing_details for insert
  with check (user_id = auth.uid());

create policy "trainer_billing_details: eigene Zeile bearbeiten"
  on trainer_billing_details for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table contracts add column credit_note_consent_at timestamptz;
alter table contracts add column confirmed_at timestamptz;
alter table contracts add column confirmed_by uuid references profiles(id) on delete set null;

create table company_billing_settings (
  company_id          uuid primary key references companies(id) on delete cascade,
  mode                text not null default 'manual' check (mode in ('manual', 'scheduled')),
  run_day             smallint not null default 1 check (run_day between 1 and 28),
  review_days         smallint not null default 3 check (review_days between 1 and 14),
  split_by_studio     boolean not null default false,
  employee_statements boolean not null default false,
  payment_days        smallint not null default 10 check (payment_days between 0 and 60),
  number_prefix       text not null default 'GS' check (number_prefix ~ '^[A-Z0-9]{1,8}$'),
  updated_at          timestamptz not null default now()
);

alter table company_billing_settings enable row level security;

create policy "company_billing_settings: admins und koordinatoren lesen"
  on company_billing_settings for select
  using (is_platform_admin() or is_company_admin(company_id) or is_company_coordinator(company_id));

create policy "company_billing_settings: admins anlegen"
  on company_billing_settings for insert
  with check (is_platform_admin() or is_company_admin(company_id));

create policy "company_billing_settings: admins bearbeiten"
  on company_billing_settings for update
  using (is_platform_admin() or is_company_admin(company_id))
  with check (is_platform_admin() or is_company_admin(company_id));

-- Lückenloser Nummernkreis je Company und Jahr (Gutschriften + Stornogutschriften).
create table credit_note_counters (
  company_id  uuid not null references companies(id) on delete cascade,
  year        integer not null,
  last_number integer not null default 0,
  primary key (company_id, year)
);

alter table credit_note_counters enable row level security;
-- Kein Zugriff für Endnutzer:innen; nur über security-definer-Funktionen.

create table billing_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  -- gesetzt bei Abrechnung je Studio; null = Beleg für die ganze Company
  studio_id   uuid references studios(id) on delete cascade,
  trainer_id  uuid not null references profiles(id),
  month       date not null check (month = date_trunc('month', month)::date),
  kind        text not null check (kind in ('credit_note', 'cancellation', 'statement')),
  number      text,
  version     integer not null default 1,
  issue_date  date not null default current_date,
  status      text not null check (status in (
                'open', 'approved', 'auto_approved', 'correction_requested', 'cancelled',
                'issued', 'superseded')),
  review_due  date,
  cancels_id  uuid references billing_documents(id),
  replaces_id uuid references billing_documents(id),
  net         numeric(12, 2) not null,
  vat_rate    numeric(5, 4) not null default 0,
  vat         numeric(12, 2) not null default 0,
  gross       numeric(12, 2) not null,
  snapshot    jsonb not null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),

  constraint billing_documents_number_required
    check ((kind = 'statement') = (number is null)),
  unique (company_id, number)
);

create index billing_documents_company_month_idx on billing_documents (company_id, month);
create index billing_documents_trainer_idx on billing_documents (trainer_id);

alter table billing_documents enable row level security;
-- Lesen ausschließlich über RPCs (Koordinator:innen dürfen nicht alle Beträge sehen).
create policy "billing_documents: platform_admin liest"
  on billing_documents for select
  using (is_platform_admin());

create table billing_comments (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references billing_documents(id) on delete cascade,
  author_id   uuid references profiles(id) on delete set null,
  kind        text not null check (kind in ('correction_request', 'comment')),
  body        text not null check (length(trim(body)) between 1 and 2000),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

create index billing_comments_document_idx on billing_comments (document_id);

alter table billing_comments enable row level security;
create policy "billing_comments: platform_admin liest"
  on billing_comments for select
  using (is_platform_admin());

-- ─────────────────────────────────────────────────────────────────
-- SCHUTZ
-- ─────────────────────────────────────────────────────────────────

-- Belege sind unveränderlich: nur Status-Felder dürfen sich ändern, Löschen nur über
-- Kaskade (Company-Offboarding). Gilt für alle Rollen, auch für security-definer-Code.
create or replace function guard_billing_documents()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- Kaskade aus dem Löschen der Company (Offboarding nach Export) ist erlaubt.
    if exists (select 1 from companies where id = old.company_id) then
      raise exception 'billing_document_immutable';
    end if;
    return old;
  end if;

  if new.company_id is distinct from old.company_id
     or new.studio_id is distinct from old.studio_id
     or new.trainer_id is distinct from old.trainer_id
     or new.month is distinct from old.month
     or new.kind is distinct from old.kind
     or new.number is distinct from old.number
     or new.version is distinct from old.version
     or new.issue_date is distinct from old.issue_date
     or new.review_due is distinct from old.review_due
     or new.cancels_id is distinct from old.cancels_id
     or new.replaces_id is distinct from old.replaces_id
     or new.net is distinct from old.net
     or new.vat_rate is distinct from old.vat_rate
     or new.vat is distinct from old.vat
     or new.gross is distinct from old.gross
     or new.snapshot is distinct from old.snapshot
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'billing_document_immutable';
  end if;

  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger billing_documents_guard
  before update or delete on billing_documents
  for each row execute function guard_billing_documents();

-- Zustimmung und Bestätigung am Vertrag nur über RPCs.
create or replace function guard_contract_billing_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.credit_note_consent_at is not null or new.confirmed_at is not null
       or new.confirmed_by is not null then
      raise exception 'contract_billing_fields_readonly';
    end if;
  elsif new.credit_note_consent_at is distinct from old.credit_note_consent_at
     or new.confirmed_at is distinct from old.confirmed_at
     or new.confirmed_by is distinct from old.confirmed_by then
    raise exception 'contract_billing_fields_readonly';
  end if;
  return new;
end;
$$;

create trigger contracts_guard_billing_columns
  before insert or update on contracts
  for each row execute function guard_contract_billing_columns();

-- Zeitstempel für geänderte Stammdaten (wird nie vom Client gesetzt).
create or replace function track_profile_master_data()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.master_data_updated_at := null;
    return new;
  end if;

  if new.full_name is distinct from old.full_name
     or new.street is distinct from old.street
     or new.house_number is distinct from old.house_number
     or new.postal_code is distinct from old.postal_code
     or new.city is distinct from old.city
     or new.kleinunternehmer is distinct from old.kleinunternehmer then
    new.master_data_updated_at := now();
  else
    new.master_data_updated_at := old.master_data_updated_at;
  end if;
  return new;
end;
$$;

create trigger profiles_track_master_data
  before insert or update on profiles
  for each row execute function track_profile_master_data();

create or replace function track_billing_details()
returns trigger language plpgsql set search_path = public as $$
begin
  new.tax_number := nullif(trim(new.tax_number), '');
  new.vat_id := nullif(upper(replace(trim(new.vat_id), ' ', '')), '');
  new.iban := nullif(upper(replace(trim(new.iban), ' ', '')), '');

  if tg_op = 'INSERT'
     or new.tax_number is distinct from old.tax_number
     or new.vat_id is distinct from old.vat_id
     or new.iban is distinct from old.iban then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;

  if new.iban is not null and not is_valid_iban(new.iban) then
    raise exception 'invalid_iban';
  end if;
  return new;
end;
$$;

-- IBAN-Prüfung (Format + Prüfziffer nach ISO 13616, mod 97).
create or replace function is_valid_iban(p_iban text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  v text := upper(replace(coalesce(p_iban, ''), ' ', ''));
  v_rearranged text;
  v_digits text := '';
  v_char text;
  v_rest integer := 0;
  i integer;
begin
  if v !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;
  v_rearranged := substr(v, 5) || substr(v, 1, 4);
  for i in 1..length(v_rearranged) loop
    v_char := substr(v_rearranged, i, 1);
    if v_char ~ '[0-9]' then
      v_digits := v_digits || v_char;
    else
      v_digits := v_digits || (ascii(v_char) - 55)::text;
    end if;
  end loop;
  for i in 1..length(v_digits) loop
    v_rest := (v_rest * 10 + substr(v_digits, i, 1)::integer) % 97;
  end loop;
  return v_rest = 1;
end;
$$;

create trigger trainer_billing_details_track
  before insert or update on trainer_billing_details
  for each row execute function track_billing_details();

revoke all on function
  guard_billing_documents(),
  guard_contract_billing_columns(),
  track_profile_master_data(),
  track_billing_details()
from public, anon, authenticated;

grant execute on function is_valid_iban(text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- VERTRAGSANNAHME MIT STAMMDATEN + BESTÄTIGUNG
-- ─────────────────────────────────────────────────────────────────

-- Nimmt ein Angebot an (pending → active) oder ergänzt die Stammdaten eines bereits
-- angenommenen Vertrags (active). Alle Felder sind Pflicht; Freiberufler:innen brauchen
-- zusätzlich Steuernummer oder USt-IdNr. und die Zustimmung zum Gutschriftverfahren.
create or replace function accept_contract_with_master_data(
  target_contract_id uuid,
  p_full_name text,
  p_street text,
  p_house_number text,
  p_postal_code text,
  p_city text,
  p_iban text,
  p_tax_number text,
  p_vat_id text,
  p_kleinunternehmer boolean,
  p_credit_note_consent boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_contract contracts%rowtype;
  v_is_freelancer boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  select * into v_contract
  from contracts
  where id = target_contract_id and trainer_id = auth.uid()
  for update;

  if not found or v_contract.status not in ('pending', 'active')
     or (v_contract.status = 'pending' and v_contract.valid_to is not null
         and v_contract.valid_to < current_date) then
    raise exception 'contract_not_found_or_not_acceptable';
  end if;

  v_is_freelancer := v_contract.employment_type = 'freelancer';

  if coalesce(trim(p_full_name), '') = '' then raise exception 'name_missing'; end if;
  if coalesce(trim(p_street), '') = '' or coalesce(trim(p_house_number), '') = ''
     or coalesce(trim(p_postal_code), '') = '' or coalesce(trim(p_city), '') = '' then
    raise exception 'address_missing';
  end if;
  if coalesce(trim(p_iban), '') = '' then raise exception 'iban_missing'; end if;
  if not is_valid_iban(p_iban) then raise exception 'invalid_iban'; end if;
  if v_is_freelancer then
    if coalesce(trim(p_tax_number), '') = '' and coalesce(trim(p_vat_id), '') = '' then
      raise exception 'tax_number_missing';
    end if;
    if not coalesce(p_credit_note_consent, false) then
      raise exception 'consent_missing';
    end if;
  end if;

  update profiles
  set full_name = trim(p_full_name),
      street = trim(p_street),
      house_number = trim(p_house_number),
      postal_code = trim(p_postal_code),
      city = trim(p_city),
      kleinunternehmer = case when v_is_freelancer then coalesce(p_kleinunternehmer, false)
                              else kleinunternehmer end
  where id = auth.uid();

  insert into trainer_billing_details (user_id, tax_number, vat_id, iban)
  values (auth.uid(), p_tax_number, p_vat_id, p_iban)
  on conflict (user_id) do update
    set tax_number = excluded.tax_number,
        vat_id = excluded.vat_id,
        iban = excluded.iban;

  update contracts
  set status = 'active',
      accepted_at = coalesce(accepted_at, now()),
      credit_note_consent_at = case when v_is_freelancer
                                    then coalesce(credit_note_consent_at, now())
                                    else credit_note_consent_at end
  where id = target_contract_id;
end;
$$;

-- Fehlende Abrechnungsangaben einer Person für einen Vertrag (leer = vollständig).
create or replace function billing_master_data_gaps(p_contract_id uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when coalesce(trim(p.full_name), '') = '' then 'name_missing' end,
    case when coalesce(trim(p.street), '') = '' or coalesce(trim(p.house_number), '') = ''
           or coalesce(trim(p.postal_code), '') = '' or coalesce(trim(p.city), '') = ''
         then 'address_missing' end,
    case when d.iban is null then 'iban_missing' end,
    case when c.employment_type = 'freelancer' and d.tax_number is null and d.vat_id is null
         then 'tax_number_missing' end,
    case when c.employment_type = 'freelancer' and c.credit_note_consent_at is null
         then 'consent_missing' end
  ], null)
  from contracts c
  join profiles p on p.id = c.trainer_id
  left join trainer_billing_details d on d.user_id = c.trainer_id
  where c.id = p_contract_id;
$$;

create or replace function confirm_contract(target_contract_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_contract contracts%rowtype;
begin
  select * into v_contract from contracts where id = target_contract_id for update;
  if not found then
    raise exception 'contract_not_found';
  end if;

  if not (is_platform_admin() or is_company_admin(v_contract.company_id)
          or coordinator_can_access_contract(v_contract.id)) then
    raise exception 'not_authorized';
  end if;

  if v_contract.status <> 'active' then
    raise exception 'contract_not_active';
  end if;

  if cardinality(billing_master_data_gaps(v_contract.id)) > 0 then
    raise exception 'master_data_incomplete';
  end if;

  update contracts
  set confirmed_at = now(), confirmed_by = auth.uid()
  where id = target_contract_id;
end;
$$;

drop function if exists get_my_contracts();
create function get_my_contracts()
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  employment_type text,
  rate_model text,
  rate_amount numeric,
  valid_from date,
  valid_to date,
  status text,
  accepted_at timestamptz,
  credit_note_consent_at timestamptz,
  confirmed_at timestamptz,
  master_data_gaps text[]
)
language sql stable security definer set search_path = public as $$
  select c.id, c.company_id, co.name, c.employment_type, c.rate_model, c.rate_amount,
         c.valid_from, c.valid_to, c.status, c.accepted_at,
         c.credit_note_consent_at, c.confirmed_at,
         case when c.status = 'active' then billing_master_data_gaps(c.id) else '{}'::text[] end
  from contracts c
  join companies co on co.id = c.company_id
  where c.trainer_id = auth.uid()
  order by c.created_at desc;
$$;

drop function if exists get_company_contracts(uuid);
create function get_company_contracts(target_company_id uuid)
returns table (
  id uuid,
  trainer_email text,
  trainer_name text,
  employment_type text,
  rate_model text,
  rate_amount numeric,
  valid_from date,
  valid_to date,
  status text,
  accepted_at timestamptz,
  studio_ids uuid[],
  confirmed_at timestamptz,
  master_data_gaps text[],
  master_data_changed boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_full_admin boolean;
begin
  v_is_full_admin := is_platform_admin() or is_company_admin(target_company_id);

  if not (v_is_full_admin or is_company_coordinator(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select
      c.id,
      u.email::text,
      case when c.accepted_at is not null then p.full_name end,
      c.employment_type,
      c.rate_model,
      c.rate_amount,
      c.valid_from,
      c.valid_to,
      c.status,
      c.accepted_at,
      coalesce(
        (select array_agg(cs.studio_id) from contract_studios cs where cs.contract_id = c.id),
        array[]::uuid[]
      ) as studio_ids,
      c.confirmed_at,
      case when c.status = 'active' then billing_master_data_gaps(c.id) else '{}'::text[] end,
      (c.confirmed_at is not null and greatest(p.master_data_updated_at, d.updated_at) > c.confirmed_at)
    from contracts c
    join auth.users u on u.id = c.trainer_id
    left join profiles p on p.id = c.trainer_id
    left join trainer_billing_details d on d.user_id = c.trainer_id
    where c.company_id = target_company_id
      and (v_is_full_admin or coordinator_can_access_contract(c.id))
    order by c.created_at desc;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- EINSTELLUNGEN
-- ─────────────────────────────────────────────────────────────────

create or replace function billing_settings_for(p_company_id uuid)
returns company_billing_settings language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s from company_billing_settings s where s.company_id = p_company_id),
    row(p_company_id, 'manual', 1, 3, false, false, 10, 'GS', now())::company_billing_settings
  );
$$;

create or replace function get_company_billing_settings(target_company_id uuid)
returns table (
  company_id uuid,
  mode text,
  run_day smallint,
  review_days smallint,
  split_by_studio boolean,
  employee_statements boolean,
  payment_days smallint,
  number_prefix text,
  billing_address_complete boolean,
  can_edit boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_admin boolean := is_platform_admin() or is_company_admin(target_company_id);
begin
  if not (v_admin or is_company_coordinator(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select s.company_id, s.mode, s.run_day, s.review_days, s.split_by_studio,
           s.employee_statements, s.payment_days, s.number_prefix,
           billing_address_complete(target_company_id), v_admin
    from billing_settings_for(target_company_id) s;
end;
$$;

create or replace function billing_address_complete(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(trim(c.name), '') <> ''
     and coalesce(trim(c.street), '') <> ''
     and coalesce(trim(c.house_number), '') <> ''
     and coalesce(trim(c.postal_code), '') <> ''
     and coalesce(trim(c.city), '') <> ''
  from companies c where c.id = p_company_id;
$$;

-- ─────────────────────────────────────────────────────────────────
-- BERECHNUNG
-- ─────────────────────────────────────────────────────────────────

-- Darf die aufrufende Person für (Company, Studio) Belege erstellen?
create or replace function billing_can_issue(p_company_id uuid, p_studio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when (billing_settings_for(p_company_id)).split_by_studio then
      p_studio_id is not null
      and exists (select 1 from studios where id = p_studio_id and company_id = p_company_id)
      and can_manage_studio(p_studio_id)
    else
      p_studio_id is null
      and (is_platform_admin() or is_company_admin(p_company_id))
  end;
$$;

-- Aktueller Stand je Person und Belegart für einen Monat (und ggf. Studio).
-- kind: credit_note (Freiberufler:innen) | statement (Minijob/Festangestellte)
create or replace function billing_compute(p_company_id uuid, p_month date, p_studio_id uuid)
returns table (
  trainer_id uuid,
  kind text,
  employment_type text,
  lines jsonb,
  course_count integer,
  minutes integer,
  fixed_amount numeric,
  net numeric,
  missing_rate integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_all_studios uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_all_studios
  from studios where company_id = p_company_id;

  return query
  with all_rows as (
    select r.*,
           case when r.employment_type = 'freelancer' or r.employment_type is null
                then 'credit_note' else 'statement' end as doc_kind
    from billing_export_rows(p_company_id, v_from, v_to, v_all_studios, null) r
    where r.category in ('given', 'substitution')
  ),
  -- Bei Abrechnung je Studio steht eine Monatspauschale nur auf dem Beleg des Studios
  -- mit dem ersten Kurs des Monats.
  first_studio as (
    select distinct on (a.trainer_id, a.doc_kind) a.trainer_id, a.doc_kind, a.studio_id
    from all_rows a
    order by a.trainer_id, a.doc_kind, a.course_date, a.start_time, a.studio_name
  ),
  scoped as (
    select a.* from all_rows a
    where p_studio_id is null or a.studio_id = p_studio_id
  )
  select
    s.trainer_id,
    s.doc_kind,
    (array_agg(s.employment_type order by s.course_date desc) filter (where s.employment_type is not null))[1],
    jsonb_agg(jsonb_build_object(
      'key', s.row_key,
      'date', s.course_date,
      'start', to_char(s.start_time, 'HH24:MI'),
      'end', to_char(s.end_time, 'HH24:MI'),
      'minutes', s.duration_min,
      'studio_id', s.studio_id,
      'studio', s.studio_name,
      'course', s.course_type_name,
      'substitution', s.category = 'substitution',
      'ad_hoc', s.is_ad_hoc,
      'rate_model', s.rate_model,
      'fee', s.fee
    ) order by s.course_date, s.start_time, s.studio_name, s.row_key),
    count(*)::integer,
    sum(s.duration_min)::integer,
    case when p_studio_id is null
           or p_studio_id = (select f.studio_id from first_studio f
                             where f.trainer_id = s.trainer_id and f.doc_kind = s.doc_kind)
         then max(s.rate_amount) filter (where s.rate_model = 'fixed')
    end,
    coalesce(sum(s.fee), 0)
      + coalesce(case when p_studio_id is null
                        or p_studio_id = (select f.studio_id from first_studio f
                                          where f.trainer_id = s.trainer_id and f.doc_kind = s.doc_kind)
                      then max(s.rate_amount) filter (where s.rate_model = 'fixed') end, 0),
    (count(*) filter (where s.rate_model is null))::integer
  from scoped s
  group by s.trainer_id, s.doc_kind;
end;
$$;

-- Gründe, warum für eine Person (noch) kein Beleg erstellt werden kann.
create or replace function billing_skip_reasons(
  p_company_id uuid, p_trainer_id uuid, p_kind text, p_month date, p_missing_rate integer
)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_contract contracts%rowtype;
  v_reasons text[] := '{}';
  v_gaps text[];
begin
  select c.* into v_contract
  from contracts c
  where c.trainer_id = p_trainer_id
    and c.company_id = p_company_id
    and c.status in ('active', 'ended')
    and ((p_kind = 'credit_note' and c.employment_type = 'freelancer')
         or (p_kind = 'statement' and c.employment_type <> 'freelancer'))
    and c.valid_from <= v_to
    and (c.valid_to is null or c.valid_to >= v_from)
  order by c.valid_from desc, c.created_at desc
  limit 1;

  if p_missing_rate > 0 then
    v_reasons := array_append(v_reasons, 'course_without_contract');
  end if;

  if v_contract.id is null then
    return array_append(v_reasons, 'contract_not_confirmed');
  end if;

  if v_contract.confirmed_at is null then
    v_reasons := array_append(v_reasons, 'contract_not_confirmed');
  end if;

  v_gaps := billing_master_data_gaps(v_contract.id);
  if p_kind = 'statement' then
    -- Für den Tätigkeitsnachweis genügt der Name.
    v_gaps := array(select g from unnest(v_gaps) g where g = 'name_missing');
  end if;

  return v_reasons || v_gaps;
end;
$$;

-- Aktueller (nicht stornierter/ersetzter) Beleg je Person/Monat/Studio/Art.
create or replace function billing_current_document(
  p_company_id uuid, p_month date, p_studio_id uuid, p_trainer_id uuid, p_kind text
)
returns billing_documents language sql stable security definer set search_path = public as $$
  select d.*
  from billing_documents d
  where d.company_id = p_company_id
    and d.month = date_trunc('month', p_month)::date
    and d.studio_id is not distinct from p_studio_id
    and d.trainer_id = p_trainer_id
    and d.kind = p_kind
    and d.status not in ('cancelled', 'superseded')
  order by d.created_at desc
  limit 1;
$$;

-- Vorschau: was beim nächsten Klick passiert (neu / unverändert / geändert / übersprungen).
create or replace function billing_preview_rows(p_company_id uuid, p_month date, p_studio_id uuid)
returns table (
  trainer_id uuid,
  trainer_name text,
  kind text,
  employment_type text,
  kleinunternehmer boolean,
  course_count integer,
  minutes integer,
  net numeric,
  vat numeric,
  gross numeric,
  current_document_id uuid,
  current_number text,
  current_status text,
  current_gross numeric,
  change text,
  changed_lines integer,
  skip_reasons text[],
  lines jsonb,
  fixed_amount numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_settings company_billing_settings := billing_settings_for(p_company_id);
begin
  return query
  with computed as (
    select c.*,
           coalesce(p.kleinunternehmer, false) as ku,
           coalesce(nullif(trim(p.full_name), ''), split_part(u.email::text, '@', 1)) as name
    from billing_compute(p_company_id, p_month, p_studio_id) c
    join auth.users u on u.id = c.trainer_id
    left join profiles p on p.id = c.trainer_id
    where c.kind = 'credit_note' or v_settings.employee_statements
  ),
  -- Personen mit bestehendem Beleg, deren Kurse inzwischen ganz weggefallen sind.
  vanished as (
    select d.trainer_id, d.kind
    from billing_documents d
    where d.company_id = p_company_id
      and d.month = date_trunc('month', p_month)::date
      and d.studio_id is not distinct from p_studio_id
      and d.kind in ('credit_note', 'statement')
      and d.status not in ('cancelled', 'superseded')
      and not exists (select 1 from computed c where c.trainer_id = d.trainer_id and c.kind = d.kind)
  ),
  merged as (
    select c.trainer_id, c.name, c.kind, c.employment_type, c.ku, c.course_count, c.minutes,
           c.net, c.lines, c.fixed_amount, c.missing_rate
    from computed c
    union all
    select v.trainer_id,
           coalesce(nullif(trim(p.full_name), ''), split_part(u.email::text, '@', 1)),
           v.kind, null, coalesce(p.kleinunternehmer, false), 0, 0, 0::numeric, '[]'::jsonb,
           null::numeric, 0
    from vanished v
    join auth.users u on u.id = v.trainer_id
    left join profiles p on p.id = v.trainer_id
  )
  select
    m.trainer_id,
    m.name,
    m.kind,
    m.employment_type,
    m.ku,
    m.course_count,
    m.minutes,
    round(m.net, 2),
    case when m.kind = 'credit_note' and not m.ku then round(m.net * 0.19, 2) else 0 end,
    round(m.net, 2) + case when m.kind = 'credit_note' and not m.ku then round(m.net * 0.19, 2) else 0 end,
    cur.id,
    cur.number,
    cur.status,
    cur.gross,
    case
      when cur.id is null then 'new'
      when (cur.snapshot -> 'lines') = m.lines
           and cur.net = round(m.net, 2)
           and (m.kind <> 'credit_note' or (cur.vat_rate > 0) = (not m.ku))
        then 'unchanged'
      else 'changed'
    end,
    case when cur.id is null then 0 else (
      select count(*)::integer from (
        (select x from jsonb_array_elements(m.lines) x
         except select y from jsonb_array_elements(cur.snapshot -> 'lines') y)
        union all
        (select y from jsonb_array_elements(cur.snapshot -> 'lines') y
         except select x from jsonb_array_elements(m.lines) x)
      ) diff
    ) end,
    case when m.course_count = 0 then '{}'::text[]
         else billing_skip_reasons(p_company_id, m.trainer_id, m.kind, p_month, m.missing_rate) end,
    m.lines,
    m.fixed_amount
  from merged m
  left join lateral billing_current_document(p_company_id, p_month, p_studio_id, m.trainer_id, m.kind) cur
    on true
  order by m.name, m.kind;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- AUSSTELLEN
-- ─────────────────────────────────────────────────────────────────

create or replace function next_credit_note_number(p_company_id uuid, p_date date)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from p_date)::integer;
  v_n integer;
begin
  insert into credit_note_counters (company_id, year, last_number)
  values (p_company_id, v_year, 1)
  on conflict (company_id, year) do update
    set last_number = credit_note_counters.last_number + 1
  returning last_number into v_n;

  return (billing_settings_for(p_company_id)).number_prefix || '-' || v_year || '-' || lpad(v_n::text, 5, '0');
end;
$$;

-- Erstellt alle fälligen Belege. Ohne Rechteprüfung (intern; Aufrufer prüft).
create or replace function billing_issue_internal(
  p_company_id uuid, p_month date, p_studio_id uuid, p_actor uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_settings company_billing_settings := billing_settings_for(p_company_id);
  v_company companies%rowtype;
  v_studio_name text;
  r record;
  v_cur billing_documents;
  v_profile profiles%rowtype;
  v_details trainer_billing_details%rowtype;
  v_contract contracts%rowtype;
  v_vat_rate numeric;
  v_vat numeric;
  v_number text;
  v_storno_number text;
  v_snapshot jsonb;
  v_created integer := 0;
  v_cancelled integer := 0;
  v_statements integer := 0;
  v_skipped integer := 0;
  v_new_id uuid;
begin
  if v_month >= date_trunc('month', current_date)::date then
    raise exception 'month_not_finished';
  end if;

  if not billing_address_complete(p_company_id) then
    raise exception 'company_billing_address_missing';
  end if;

  select * into v_company from companies where id = p_company_id;
  select name into v_studio_name from studios where id = p_studio_id;

  for r in select * from billing_preview_rows(p_company_id, v_month, p_studio_id) loop
    if r.change = 'unchanged' then
      continue;
    end if;
    if cardinality(r.skip_reasons) > 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_cur := billing_current_document(p_company_id, v_month, p_studio_id, r.trainer_id, r.kind);

    select * into v_profile from profiles where id = r.trainer_id;
    select * into v_details from trainer_billing_details where user_id = r.trainer_id;
    select c.* into v_contract
    from contracts c
    where c.trainer_id = r.trainer_id and c.company_id = p_company_id
      and c.status in ('active', 'ended')
      and ((r.kind = 'credit_note' and c.employment_type = 'freelancer')
           or (r.kind = 'statement' and c.employment_type <> 'freelancer'))
      and c.valid_from <= (v_month + interval '1 month' - interval '1 day')::date
      and (c.valid_to is null or c.valid_to >= v_month)
    order by c.valid_from desc, c.created_at desc
    limit 1;

    -- Bestehende Gutschrift stornieren (auch wenn die Person keine Kurse mehr hat).
    if v_cur.id is not null and r.kind = 'credit_note' then
      v_storno_number := next_credit_note_number(p_company_id, current_date);
      update billing_documents set status = 'cancelled' where id = v_cur.id;
      insert into billing_documents (
        company_id, studio_id, trainer_id, month, kind, number, status, cancels_id,
        net, vat_rate, vat, gross, snapshot, created_by
      ) values (
        p_company_id, p_studio_id, r.trainer_id, v_month, 'cancellation', v_storno_number,
        'issued', v_cur.id, -v_cur.net, v_cur.vat_rate, -v_cur.vat, -v_cur.gross,
        v_cur.snapshot || jsonb_build_object(
          'cancels', jsonb_build_object('number', v_cur.number, 'issue_date', v_cur.issue_date),
          'correction_request', (
            select bc.body from billing_comments bc
            where bc.document_id = v_cur.id and bc.kind = 'correction_request'
            order by bc.created_at desc limit 1)
        ),
        p_actor
      );
      v_cancelled := v_cancelled + 1;
    elsif v_cur.id is not null and r.kind = 'statement' then
      update billing_documents set status = 'superseded' where id = v_cur.id;
    end if;

    -- Keine Kurse mehr → nur Storno, kein neuer Beleg.
    if r.course_count = 0 then
      continue;
    end if;

    v_vat_rate := case when r.kind = 'credit_note' and not r.kleinunternehmer then 0.19 else 0 end;
    v_vat := round(r.net * v_vat_rate, 2);

    v_snapshot := jsonb_build_object(
      'issuer', jsonb_build_object(
        'name', v_company.name, 'street', v_company.street, 'house_number', v_company.house_number,
        'postal_code', v_company.postal_code, 'city', v_company.city, 'country', v_company.country),
      'recipient', jsonb_build_object(
        'name', v_profile.full_name, 'street', v_profile.street,
        'house_number', v_profile.house_number, 'postal_code', v_profile.postal_code,
        'city', v_profile.city, 'country', v_profile.country,
        'tax_number', v_details.tax_number, 'vat_id', v_details.vat_id, 'iban', v_details.iban,
        'kleinunternehmer', r.kleinunternehmer),
      'studio_name', v_studio_name,
      'employment_type', coalesce(r.employment_type, v_contract.employment_type),
      'rate_model', v_contract.rate_model,
      'rate_amount', v_contract.rate_amount,
      'consent_at', v_contract.credit_note_consent_at,
      'period_from', v_month,
      'period_to', (v_month + interval '1 month' - interval '1 day')::date,
      'payment_due', current_date + v_settings.payment_days,
      'payment_days', v_settings.payment_days,
      'lines', r.lines,
      'fixed_amount', r.fixed_amount,
      'course_count', r.course_count,
      'minutes', r.minutes
    );

    if r.kind = 'credit_note' then
      v_number := next_credit_note_number(p_company_id, current_date);
      if v_cur.id is not null then
        v_snapshot := v_snapshot || jsonb_build_object('replaces', jsonb_build_object(
          'number', v_cur.number, 'issue_date', v_cur.issue_date, 'gross', v_cur.gross,
          'cancellation_number', v_storno_number, 'cancellation_date', current_date));
      end if;
      insert into billing_documents (
        company_id, studio_id, trainer_id, month, kind, number, status, review_due,
        replaces_id, net, vat_rate, vat, gross, snapshot, created_by
      ) values (
        p_company_id, p_studio_id, r.trainer_id, v_month, 'credit_note', v_number, 'open',
        current_date + v_settings.review_days, v_cur.id,
        round(r.net, 2), v_vat_rate, v_vat, round(r.net, 2) + v_vat, v_snapshot, p_actor
      ) returning id into v_new_id;
      v_created := v_created + 1;
    else
      insert into billing_documents (
        company_id, studio_id, trainer_id, month, kind, version, status, replaces_id,
        net, vat_rate, vat, gross, snapshot, created_by
      ) values (
        p_company_id, p_studio_id, r.trainer_id, v_month, 'statement',
        coalesce(v_cur.version + 1, 1), 'issued', v_cur.id,
        round(r.net, 2), 0, 0, round(r.net, 2), v_snapshot, p_actor
      );
      v_statements := v_statements + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_created, 'cancelled', v_cancelled,
    'statements', v_statements, 'skipped', v_skipped);
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- ÖFFENTLICHE RPCs: STUDIO-SEITE
-- ─────────────────────────────────────────────────────────────────

create or replace function issue_billing_documents(
  target_company_id uuid, p_month date, p_studio_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not billing_can_issue(target_company_id, p_studio_id) then
    raise exception 'not_authorized';
  end if;
  return billing_issue_internal(target_company_id, p_month, p_studio_id, auth.uid());
end;
$$;

create or replace function get_billing_preview(
  target_company_id uuid, p_month date, p_studio_id uuid default null
)
returns table (
  trainer_id uuid,
  trainer_name text,
  kind text,
  employment_type text,
  kleinunternehmer boolean,
  course_count integer,
  minutes integer,
  net numeric,
  vat numeric,
  gross numeric,
  current_document_id uuid,
  current_number text,
  current_status text,
  current_gross numeric,
  change text,
  changed_lines integer,
  skip_reasons text[]
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not billing_can_issue(target_company_id, p_studio_id) then
    raise exception 'not_authorized';
  end if;

  return query
    select p.trainer_id, p.trainer_name, p.kind, p.employment_type, p.kleinunternehmer,
           p.course_count, p.minutes, p.net, p.vat, p.gross, p.current_document_id,
           p.current_number, p.current_status, p.current_gross, p.change, p.changed_lines,
           p.skip_reasons
    from billing_preview_rows(target_company_id, p_month, p_studio_id) p;
end;
$$;

-- Darf die aufrufende Person einen Beleg (Status/Kommentare) sehen? Beträge sieht sie nur,
-- wenn sie für alle Kurse darauf zuständig ist.
create or replace function billing_document_access(p_document_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_doc billing_documents%rowtype;
begin
  select * into v_doc from billing_documents where id = p_document_id;
  if not found then
    return 'none';
  end if;
  if is_platform_admin() or is_company_admin(v_doc.company_id) then
    return 'full';
  end if;
  if v_doc.trainer_id = auth.uid() then
    return 'owner';
  end if;
  if v_doc.studio_id is not null and is_studio_coordinator(v_doc.studio_id) then
    return 'full';
  end if;
  if v_doc.studio_id is null and exists (
    select 1 from jsonb_array_elements(v_doc.snapshot -> 'lines') l
    where is_studio_coordinator((l ->> 'studio_id')::uuid)
  ) then
    return 'status';
  end if;
  return 'none';
end;
$$;

create or replace function get_billing_documents(target_company_id uuid, p_month date)
returns table (
  id uuid,
  studio_id uuid,
  studio_name text,
  trainer_id uuid,
  trainer_name text,
  kind text,
  number text,
  version integer,
  issue_date date,
  status text,
  review_due date,
  net numeric,
  vat numeric,
  gross numeric,
  course_count integer,
  open_comments integer,
  can_view_amounts boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)
          or is_company_coordinator(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select d.id, d.studio_id, s.name, d.trainer_id, d.snapshot -> 'recipient' ->> 'name',
           d.kind, d.number, d.version, d.issue_date, d.status, d.review_due,
           case when a.lvl = 'full' then d.net end,
           case when a.lvl = 'full' then d.vat end,
           case when a.lvl = 'full' then d.gross end,
           jsonb_array_length(d.snapshot -> 'lines'),
           (select count(*)::integer from billing_comments c
            where c.document_id = d.id and c.resolved_at is null),
           a.lvl = 'full'
    from billing_documents d
    left join studios s on s.id = d.studio_id
    cross join lateral (select billing_document_access(d.id) as lvl) a
    where d.company_id = target_company_id
      and d.month = date_trunc('month', p_month)::date
      and a.lvl in ('full', 'status')
    order by d.snapshot -> 'recipient' ->> 'name', d.created_at;
end;
$$;

create or replace function get_billing_comments(target_company_id uuid, p_month date)
returns table (
  id uuid,
  document_id uuid,
  document_kind text,
  document_number text,
  document_version integer,
  trainer_name text,
  kind text,
  body text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by_name text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)
          or is_company_coordinator(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select c.id, d.id, d.kind, d.number, d.version, d.snapshot -> 'recipient' ->> 'name',
           c.kind, c.body, c.created_at, c.resolved_at, rp.full_name
    from billing_comments c
    join billing_documents d on d.id = c.document_id
    left join profiles rp on rp.id = c.resolved_by
    where d.company_id = target_company_id
      and d.month = date_trunc('month', p_month)::date
      and billing_document_access(d.id) in ('full', 'status')
    order by (c.resolved_at is null) desc, c.created_at desc;
end;
$$;

create or replace function resolve_billing_comment(target_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_document_id uuid;
begin
  select document_id into v_document_id from billing_comments where id = target_comment_id;
  if v_document_id is null or billing_document_access(v_document_id) not in ('full', 'status') then
    raise exception 'not_authorized';
  end if;

  update billing_comments
  set resolved_at = now(), resolved_by = auth.uid()
  where id = target_comment_id and resolved_at is null;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- ÖFFENTLICHE RPCs: TRAINER-SEITE
-- ─────────────────────────────────────────────────────────────────

create or replace function get_my_billing_documents()
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  studio_name text,
  month date,
  kind text,
  number text,
  version integer,
  issue_date date,
  status text,
  review_due date,
  gross numeric,
  vat numeric,
  course_count integer,
  replaces_number text,
  last_comment text
)
language sql stable security definer set search_path = public as $$
  select d.id, d.company_id, d.snapshot -> 'issuer' ->> 'name', d.snapshot ->> 'studio_name',
         d.month, d.kind, d.number, d.version, d.issue_date, d.status, d.review_due, d.gross,
         d.vat, jsonb_array_length(d.snapshot -> 'lines'),
         coalesce(d.snapshot -> 'replaces' ->> 'number', d.snapshot -> 'cancels' ->> 'number'),
         (select c.body from billing_comments c where c.document_id = d.id
          order by c.created_at desc limit 1)
  from billing_documents d
  where d.trainer_id = auth.uid()
  order by d.month desc, d.created_at desc;
$$;

-- Vollständiger Beleg inkl. Kopie für die PDF-Erzeugung.
create or replace function get_billing_document(target_document_id uuid)
returns table (
  id uuid,
  kind text,
  number text,
  version integer,
  issue_date date,
  status text,
  review_due date,
  net numeric,
  vat_rate numeric,
  vat numeric,
  gross numeric,
  snapshot jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  if billing_document_access(target_document_id) not in ('full', 'owner') then
    raise exception 'not_authorized';
  end if;

  return query
    select d.id, d.kind, d.number, d.version, d.issue_date, d.status, d.review_due,
           d.net, d.vat_rate, d.vat, d.gross, d.snapshot
    from billing_documents d where d.id = target_document_id;
end;
$$;

create or replace function approve_billing_document(target_document_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update billing_documents
  set status = 'approved'
  where id = target_document_id
    and trainer_id = auth.uid()
    and kind = 'credit_note'
    and status = 'open';

  if not found then
    raise exception 'document_not_found_or_not_open';
  end if;
end;
$$;

-- Gutschrift: Korrektur anfordern (Status → correction_requested).
-- Tätigkeitsnachweis: optionaler Kommentar, Status bleibt.
create or replace function comment_billing_document(target_document_id uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_doc billing_documents%rowtype;
begin
  select * into v_doc from billing_documents
  where id = target_document_id and trainer_id = auth.uid()
  for update;

  if not found then
    raise exception 'document_not_found';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'comment_required';
  end if;

  if v_doc.kind = 'credit_note' then
    if v_doc.status not in ('open', 'approved', 'auto_approved', 'correction_requested') then
      raise exception 'document_not_correctable';
    end if;
    insert into billing_comments (document_id, author_id, kind, body)
    values (v_doc.id, auth.uid(), 'correction_request', trim(p_body));
    update billing_documents set status = 'correction_requested'
    where id = v_doc.id and status <> 'correction_requested';
  elsif v_doc.kind = 'statement' and v_doc.status = 'issued' then
    insert into billing_comments (document_id, author_id, kind, body)
    values (v_doc.id, auth.uid(), 'comment', trim(p_body));
  else
    raise exception 'document_not_correctable';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- TÄGLICHER JOB: Fristablauf + Stichtag
-- ─────────────────────────────────────────────────────────────────

create or replace function billing_run_daily(p_today date default current_date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auto integer;
  v_runs integer := 0;
  v_failed integer := 0;
  r record;
  v_month date := (date_trunc('month', p_today) - interval '1 month')::date;
begin
  update billing_documents
  set status = 'auto_approved'
  where kind = 'credit_note' and status = 'open' and review_due < p_today;
  get diagnostics v_auto = row_count;

  for r in
    select s.company_id, s.split_by_studio, st.id as studio_id
    from company_billing_settings s
    left join studios st on s.split_by_studio and st.company_id = s.company_id
    where s.mode = 'scheduled'
      and s.run_day = extract(day from p_today)::integer
      and (not s.split_by_studio or st.id is not null)
  loop
    begin
      perform billing_issue_internal(r.company_id, v_month, r.studio_id, null);
      v_runs := v_runs + 1;
    exception when others then
      -- z. B. fehlende Rechnungsanschrift: die Company sieht den Fehler im Tab.
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object('auto_approved', v_auto, 'runs', v_runs, 'failed', v_failed);
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- DSGVO: Belege werden 8 Jahre aufbewahrt
-- ─────────────────────────────────────────────────────────────────

create or replace function gdpr_user_has_retained_records(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from contracts where trainer_id = p_user_id)
      or exists (select 1 from course_sessions where trainer_id = p_user_id)
      or exists (select 1 from course_plan_slots where trainer_id = p_user_id)
      or exists (
        select 1 from substitute_assignments
        where p_user_id in (original_trainer_id, substitute_trainer_id)
      )
      or exists (select 1 from billing_documents where trainer_id = p_user_id);
$$;

create or replace function gdpr_scrub_profile(p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  -- Offene und künftige Vertretungen mit der Person sind hinfällig.
  update substitute_assignments
  set status = 'cancelled', responded_at = coalesce(responded_at, now())
  where p_user_id in (original_trainer_id, substitute_trainer_id)
    and (status = 'pending' or (status = 'accepted' and date >= current_date));

  -- Nie wirksam gewordene Angebote haben keine Aufbewahrungspflicht.
  delete from contracts where trainer_id = p_user_id and status in ('pending', 'declined');

  -- Laufende Contracts enden mit dem heutigen Tag (frühestens zum Vertragsbeginn).
  update contracts
  set status = 'ended',
      valid_to = greatest(valid_from, least(coalesce(valid_to, current_date), current_date))
  where trainer_id = p_user_id and status = 'active';

  delete from company_admins where user_id = p_user_id;
  delete from studio_coordinators where user_id = p_user_id;
  delete from platform_admins where user_id = p_user_id;
  -- IBAN/Steuernummer: auf ausgestellten Belegen (Kopie) bleiben sie erhalten.
  delete from trainer_billing_details where user_id = p_user_id;

  if gdpr_user_has_retained_records(p_user_id) then
    update profiles
    set full_name = 'Gelöschtes Konto',
        phone = null,
        street = null,
        house_number = null,
        postal_code = null,
        city = null,
        deleted_at = coalesce(deleted_at, now())
    where id = p_user_id;
    return 'anonymized';
  end if;

  delete from profiles where id = p_user_id;
  return 'deleted';
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RECHTE
-- ─────────────────────────────────────────────────────────────────

revoke all on function
  billing_master_data_gaps(uuid),
  billing_settings_for(uuid),
  billing_address_complete(uuid),
  billing_can_issue(uuid, uuid),
  billing_compute(uuid, date, uuid),
  billing_skip_reasons(uuid, uuid, text, date, integer),
  billing_current_document(uuid, date, uuid, uuid, text),
  billing_preview_rows(uuid, date, uuid),
  next_credit_note_number(uuid, date),
  billing_issue_internal(uuid, date, uuid, uuid),
  billing_document_access(uuid),
  billing_run_daily(date),
  gdpr_user_has_retained_records(uuid),
  gdpr_scrub_profile(uuid)
from public, anon, authenticated;

revoke all on function
  accept_contract_with_master_data(uuid, text, text, text, text, text, text, text, text, boolean, boolean),
  confirm_contract(uuid),
  get_my_contracts(),
  get_company_contracts(uuid),
  get_company_billing_settings(uuid),
  issue_billing_documents(uuid, date, uuid),
  get_billing_preview(uuid, date, uuid),
  get_billing_documents(uuid, date),
  get_billing_comments(uuid, date),
  resolve_billing_comment(uuid),
  get_my_billing_documents(),
  get_billing_document(uuid),
  approve_billing_document(uuid),
  comment_billing_document(uuid, text)
from public, anon;

grant execute on function
  accept_contract_with_master_data(uuid, text, text, text, text, text, text, text, text, boolean, boolean),
  confirm_contract(uuid),
  get_my_contracts(),
  get_company_contracts(uuid),
  get_company_billing_settings(uuid),
  issue_billing_documents(uuid, date, uuid),
  get_billing_preview(uuid, date, uuid),
  get_billing_documents(uuid, date),
  get_billing_comments(uuid, date),
  resolve_billing_comment(uuid),
  get_my_billing_documents(),
  get_billing_document(uuid),
  approve_billing_document(uuid),
  comment_billing_document(uuid, text)
to authenticated, service_role;

grant execute on function billing_run_daily(date) to service_role;

grant select, insert, update on trainer_billing_details to authenticated;
grant select, insert, update on company_billing_settings to authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Täglicher Abrechnungs-Job (04:05 UTC), sofern pg_cron verfügbar ist.
-- ─────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'billing-run-daily',
      '5 4 * * *',
      'select public.billing_run_daily()'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
