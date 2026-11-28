-- Rollenmodell erweitern (2026-11-28)
--
-- Rollen:
--   * Plattform-Admin: alles, mehrere Personen möglich (platform_admins). Neu: Plattform-Admins
--     verwalten sich gegenseitig per RPC (add/remove/get), der letzte bleibt immer bestehen.
--   * Company-Admin: alles innerhalb der Company.
--   * Studio-Admin (intern weiter `studio_coordinators`): alles studioweite für die eigenen
--     Studios. Einige Rechte legt der Company-Admin pro Company fest (studio_admin_permissions):
--       - course_types: Kurstypen der eigenen Studios anlegen/ändern/löschen
--       - contracts:    Verträge anbieten (und beenden)
--       - billing:      Abrechnungen ausstellen, wenn die Abrechnung NICHT nach Studios getrennt
--                       ist (bei getrennter Abrechnung dürfen Studio-Admins das für ihre Studios
--                       ohnehin)
--     Stufen: 'allowed' (darf), 'denied' (darf nicht), 'approval' (darf, Company-Admin bestätigt).
--     billing kennt nur allowed/denied.
--   * Trainer:in: Verträge mit mehreren Companies. Verträge gelten company-weit; der
--     Company-Admin kann sie optional auf Studios beschränken (contract_studios). Diese
--     Beschränkung wird jetzt auch für Trainer:innen durchgesetzt (Studios, Pläne, Kurse
--     erfassen, Vertretungen).

-- ─────────────────────────────────────────────────────────────────
-- 1. Rechte der Studio-Admins pro Company
-- ─────────────────────────────────────────────────────────────────

create table studio_admin_permissions (
  company_id   uuid primary key references companies(id) on delete cascade,
  course_types text not null default 'approval'
    check (course_types in ('allowed', 'denied', 'approval')),
  contracts    text not null default 'approval'
    check (contracts in ('allowed', 'denied', 'approval')),
  billing      text not null default 'denied'
    check (billing in ('allowed', 'denied')),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id) on delete set null
);

alter table studio_admin_permissions enable row level security;

create policy "studio_admin_permissions: admins und studio-admins lesen"
  on studio_admin_permissions for select
  using (
    is_platform_admin()
    or is_company_admin(company_id)
    or is_company_coordinator(company_id)
  );

create policy "studio_admin_permissions: admins verwalten"
  on studio_admin_permissions for all
  using (is_platform_admin() or is_company_admin(company_id))
  with check (is_platform_admin() or is_company_admin(company_id));

-- Liefert die Stufe eines Rechts (mit Standardwerten, wenn noch nichts eingestellt ist).
create or replace function studio_admin_permission(p_company_id uuid, p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case p_key
    when 'course_types' then coalesce((select course_types from studio_admin_permissions where company_id = p_company_id), 'approval')
    when 'contracts'    then coalesce((select contracts    from studio_admin_permissions where company_id = p_company_id), 'approval')
    when 'billing'      then coalesce((select billing      from studio_admin_permissions where company_id = p_company_id), 'denied')
    else 'denied'
  end;
$$;

create or replace function get_studio_admin_permissions(target_company_id uuid)
returns table (course_types text, contracts text, billing text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)
          or is_company_coordinator(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select studio_admin_permission(target_company_id, 'course_types'),
           studio_admin_permission(target_company_id, 'contracts'),
           studio_admin_permission(target_company_id, 'billing');
end;
$$;

create or replace function set_studio_admin_permissions(
  target_company_id uuid,
  p_course_types text,
  p_contracts text,
  p_billing text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  if p_course_types not in ('allowed', 'denied', 'approval')
     or p_contracts not in ('allowed', 'denied', 'approval')
     or p_billing not in ('allowed', 'denied') then
    raise exception 'invalid_permission';
  end if;

  insert into studio_admin_permissions (company_id, course_types, contracts, billing, updated_at, updated_by)
  values (target_company_id, p_course_types, p_contracts, p_billing, now(), auth.uid())
  on conflict (company_id) do update
    set course_types = excluded.course_types,
        contracts = excluded.contracts,
        billing = excluded.billing,
        updated_at = now(),
        updated_by = auth.uid();
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 2. Verträge: company-weit, Bestätigung durch Company-Admin, Studio-Beschränkung
-- ─────────────────────────────────────────────────────────────────

alter table contracts
  add column approval_status text not null default 'approved'
    check (approval_status in ('approved', 'pending_approval')),
  add column created_by uuid references profiles(id) on delete set null;

-- Solange ein Vertrag auf Bestätigung wartet, kann die Trainer:in ihn weder annehmen noch
-- ablehnen. Den Bestätigungsstatus ändern nur Company-Admins/Plattform-Admins.
create or replace function guard_contract_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.approval_status <> 'approved'
       and not (is_platform_admin() or is_company_admin(new.company_id)
                or is_company_coordinator(new.company_id)) then
      raise exception 'not_authorized';
    end if;
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status
     and not (is_platform_admin() or is_company_admin(new.company_id)) then
    raise exception 'not_authorized';
  end if;

  if old.approval_status = 'pending_approval'
     and new.approval_status = 'pending_approval'
     and new.status is distinct from old.status then
    raise exception 'contract_awaiting_approval';
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_guard_approval on contracts;
create trigger contracts_guard_approval
  before insert or update on contracts
  for each row execute function guard_contract_approval();

-- Trainer:innen sehen Verträge erst, wenn sie bestätigt sind.
drop policy if exists "contracts: trainer liest eigene" on contracts;
create policy "contracts: trainer liest eigene"
  on contracts for select
  using (trainer_id = auth.uid() and approval_status = 'approved');

-- Studio-Admins dürfen Verträge nur direkt bearbeiten (z. B. beenden), wenn das Recht
-- „Verträge“ auf „darf“ steht.
drop policy if exists "contracts: coordinator bearbeiten" on contracts;
create policy "contracts: coordinator bearbeiten"
  on contracts for update
  using (
    coordinator_can_access_contract(id)
    and studio_admin_permission(company_id, 'contracts') = 'allowed'
  )
  with check (
    coordinator_can_access_contract(id)
    and studio_admin_permission(company_id, 'contracts') = 'allowed'
  );

-- Studio-Admins sehen company-weite Verträge (sie dürfen die Trainer:innen in ihren Studios
-- einplanen), auf ihre Studios beschränkte Verträge und Verträge, die sie selbst angeboten
-- haben. Verträge, die auf andere Studios beschränkt sind, bleiben unsichtbar.
create or replace function coordinator_can_access_contract(target_contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from contracts c
    where c.id = target_contract_id
      and is_company_coordinator(c.company_id)
      and (
        c.created_by = auth.uid()
        or not exists (select 1 from contract_studios cs where cs.contract_id = c.id)
        or exists (
          select 1
          from contract_studios cs
          join studio_coordinators sc
            on sc.studio_id = cs.studio_id
           and sc.user_id = auth.uid()
          where cs.contract_id = c.id
        )
      )
  );
$$;

drop function if exists offer_contract(uuid, text, text, text, numeric, date, date, uuid[]);
create function offer_contract(
  target_company_id uuid,
  target_email text,
  p_employment_type text,
  p_rate_model text,
  p_rate_amount numeric,
  p_valid_from date,
  p_valid_to date default null,
  p_studio_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_contract_id uuid;
  v_is_full_admin boolean;
  v_permission text;
  v_approval text := 'approved';
  v_sid uuid;
begin
  v_is_full_admin := is_platform_admin() or is_company_admin(target_company_id);

  if not v_is_full_admin then
    if not is_company_coordinator(target_company_id) then
      raise exception 'not_authorized';
    end if;

    v_permission := studio_admin_permission(target_company_id, 'contracts');
    if v_permission = 'denied' then
      raise exception 'not_authorized';
    end if;
    if v_permission = 'approval' then
      v_approval := 'pending_approval';
    end if;

    -- Verträge gelten company-weit; nur Company-Admins beschränken sie auf Studios.
    if p_studio_ids is not null and cardinality(p_studio_ids) > 0 then
      raise exception 'studio_restriction_admin_only';
    end if;
  elsif p_studio_ids is not null then
    foreach v_sid in array p_studio_ids loop
      if not exists (select 1 from studios where id = v_sid and company_id = target_company_id) then
        raise exception 'contract_studio_company_mismatch';
      end if;
    end loop;
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(target_email);
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into contracts (
    trainer_id, company_id, employment_type, rate_model, rate_amount, valid_from, valid_to,
    status, approval_status, created_by
  ) values (
    v_user_id, target_company_id, p_employment_type, p_rate_model, p_rate_amount,
    p_valid_from, p_valid_to, 'pending', v_approval, auth.uid()
  )
  returning id into v_contract_id;

  if v_is_full_admin and p_studio_ids is not null then
    foreach v_sid in array p_studio_ids loop
      insert into contract_studios (contract_id, studio_id)
      values (v_contract_id, v_sid)
      on conflict do nothing;
    end loop;
  end if;

  return v_contract_id;
end;
$$;

-- Company-Admin bestätigt oder verwirft ein Vertragsangebot eines Studio-Admins.
-- Optional beschränkt er den Vertrag beim Bestätigen auf Studios.
create or replace function review_contract(
  target_contract_id uuid,
  p_approve boolean,
  p_studio_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract contracts%rowtype;
begin
  select * into v_contract from contracts where id = target_contract_id for update;
  if not found then
    raise exception 'contract_not_found';
  end if;

  if not (is_platform_admin() or is_company_admin(v_contract.company_id)) then
    raise exception 'not_authorized';
  end if;

  if v_contract.approval_status <> 'pending_approval' then
    raise exception 'contract_not_awaiting_approval';
  end if;

  if not p_approve then
    delete from contracts where id = target_contract_id;
    return;
  end if;

  update contracts set approval_status = 'approved' where id = target_contract_id;

  if p_studio_ids is not null then
    perform set_contract_studios(target_contract_id, p_studio_ids);
  end if;
end;
$$;

-- Company-Admin beschränkt einen Vertrag auf Studios (leer = alle Studios der Company).
create or replace function set_contract_studios(target_contract_id uuid, p_studio_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_sid uuid;
begin
  select company_id into v_company_id from contracts where id = target_contract_id;
  if v_company_id is null then
    raise exception 'contract_not_found';
  end if;

  if not (is_platform_admin() or is_company_admin(v_company_id)) then
    raise exception 'not_authorized';
  end if;

  if p_studio_ids is not null then
    foreach v_sid in array p_studio_ids loop
      if not exists (select 1 from studios where id = v_sid and company_id = v_company_id) then
        raise exception 'contract_studio_company_mismatch';
      end if;
    end loop;
  end if;

  delete from contract_studios where contract_id = target_contract_id;

  if p_studio_ids is not null then
    insert into contract_studios (contract_id, studio_id)
    select target_contract_id, sid from unnest(p_studio_ids) as sid
    on conflict do nothing;
  end if;
end;
$$;

create or replace function get_my_contracts()
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
    and c.approval_status = 'approved'
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
  master_data_changed boolean,
  approval_status text,
  created_by_name text
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
      (c.confirmed_at is not null and greatest(p.master_data_updated_at, d.updated_at) > c.confirmed_at),
      c.approval_status,
      (select coalesce(nullif(trim(cp.full_name), ''), cu.email::text)
         from auth.users cu left join profiles cp on cp.id = cu.id
        where cu.id = c.created_by)
    from contracts c
    join auth.users u on u.id = c.trainer_id
    left join profiles p on p.id = c.trainer_id
    left join trainer_billing_details d on d.user_id = c.trainer_id
    where c.company_id = target_company_id
      and (v_is_full_admin or coordinator_can_access_contract(c.id))
    order by (c.approval_status = 'pending_approval') desc, c.created_at desc;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 3. Freigabe der Trainer:innen pro Studio
-- ─────────────────────────────────────────────────────────────────

-- Trainer:in hat am Stichtag einen aktiven, bestätigten Vertrag mit der Company des Studios,
-- der nicht auf andere Studios beschränkt ist.
create or replace function trainer_cleared_for_studio(
  p_trainer_id uuid,
  p_studio_id uuid,
  p_on date default current_date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from contracts c
    join studios s on s.company_id = c.company_id
    where s.id = p_studio_id
      and c.trainer_id = p_trainer_id
      and c.status = 'active'
      and c.approval_status = 'approved'
      and c.valid_from <= p_on
      and (c.valid_to is null or c.valid_to >= p_on)
      and (
        not exists (select 1 from contract_studios cs where cs.contract_id = c.id)
        or exists (select 1 from contract_studios cs where cs.contract_id = c.id and cs.studio_id = p_studio_id)
      )
  ) and (
    p_trainer_id = auth.uid()
    or can_manage_studio(p_studio_id)
  );
$$;

drop policy if exists "studios: trainer mit aktivem contract" on studios;
create policy "studios: trainer mit aktivem contract"
  on studios for select
  using (trainer_cleared_for_studio(auth.uid(), id));

drop policy if exists "course_plans: trainer mit aktivem contract" on course_plans;
create policy "course_plans: trainer mit aktivem contract"
  on course_plans for select
  using (trainer_cleared_for_studio(auth.uid(), studio_id));

drop policy if exists "course_plan_slots: trainer mit aktivem contract" on course_plan_slots;
create policy "course_plan_slots: trainer mit aktivem contract"
  on course_plan_slots for select
  using (
    trainer_cleared_for_studio(auth.uid(), (
      select cp.studio_id from course_plans cp where cp.id = course_plan_slots.course_plan_id
    ))
  );

drop policy if exists "course_sessions: trainer erfasst eigene" on course_sessions;
create policy "course_sessions: trainer erfasst eigene"
  on course_sessions for insert
  with check (
    trainer_id = auth.uid()
    and locked_at is null
    and locked_by is null
    and trainer_cleared_for_studio(auth.uid(), studio_id)
  );

drop policy if exists "course_sessions: trainer bearbeitet eigene offene" on course_sessions;
create policy "course_sessions: trainer bearbeitet eigene offene"
  on course_sessions for update
  using (trainer_id = auth.uid() and locked_at is null)
  with check (
    trainer_id = auth.uid()
    and locked_at is null
    and locked_by is null
    and trainer_cleared_for_studio(auth.uid(), studio_id)
  );

drop policy if exists "course_sessions: trainer löscht eigene offene" on course_sessions;
create policy "course_sessions: trainer löscht eigene offene"
  on course_sessions for delete
  using (
    trainer_id = auth.uid()
    and locked_at is null
    and trainer_cleared_for_studio(auth.uid(), studio_id)
  );

create or replace function get_trainer_studios()
returns table (
  studio_id uuid,
  studio_name text,
  company_id uuid,
  company_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as studio_id,
    s.name as studio_name,
    c.id as company_id,
    c.name as company_name
  from studios s
  join companies c on c.id = s.company_id
  where trainer_cleared_for_studio(auth.uid(), s.id)
  order by c.name asc, s.name asc;
$$;

create or replace function get_trainer_studio_slots()
returns table (
  slot_id uuid,
  studio_id uuid,
  studio_name text,
  company_id uuid,
  company_name text,
  course_plan_id uuid,
  plan_valid_from date,
  weekday smallint,
  start_time time,
  end_time time,
  course_type_id uuid,
  course_type_name text,
  scheduled_trainer_id uuid,
  scheduled_trainer_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sl.id as slot_id,
    s.id as studio_id,
    s.name as studio_name,
    c.id as company_id,
    c.name as company_name,
    cp.id as course_plan_id,
    cp.valid_from as plan_valid_from,
    sl.weekday,
    sl.start_time,
    sl.end_time,
    sl.course_type_id,
    ct.name as course_type_name,
    sl.trainer_id as scheduled_trainer_id,
    coalesce(nullif(trim(p.full_name), ''), split_part(u.email::text, '@', 1)) as scheduled_trainer_name
  from course_plan_slots sl
  join course_plans cp on cp.id = sl.course_plan_id and cp.status = 'active'
  join studios s on s.id = cp.studio_id
  join companies c on c.id = s.company_id
  join course_types ct on ct.id = sl.course_type_id
  join auth.users u on u.id = sl.trainer_id
  left join profiles p on p.id = sl.trainer_id
  where trainer_cleared_for_studio(auth.uid(), s.id)
  order by sl.weekday asc, sl.start_time asc, s.name asc;
$$;

-- Kolleg:innen für Vertretungen: optional nur die, die für das Studio freigegeben sind.
drop function if exists get_company_colleagues(uuid);
create function get_company_colleagues(target_company_id uuid, p_studio_id uuid default null)
returns table (
  trainer_id uuid,
  display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    is_platform_admin()
    or is_company_admin(target_company_id)
    or is_company_coordinator(target_company_id)
    or has_active_contract(auth.uid(), target_company_id)
  ) then
    raise exception 'not_authorized';
  end if;

  if p_studio_id is not null
     and not exists (select 1 from studios where id = p_studio_id and company_id = target_company_id) then
    raise exception 'studio_company_mismatch';
  end if;

  return query
    select distinct on (c.trainer_id)
      c.trainer_id,
      coalesce(nullif(trim(p.full_name), ''), split_part(u.email::text, '@', 1)) as display_name
    from contracts c
    join auth.users u on u.id = c.trainer_id
    left join profiles p on p.id = c.trainer_id
    where c.company_id = target_company_id
      and c.status = 'active'
      and c.approval_status = 'approved'
      and (c.valid_to is null or c.valid_to >= current_date)
      and (
        p_studio_id is null
        or not exists (select 1 from contract_studios cs where cs.contract_id = c.id)
        or exists (select 1 from contract_studios cs where cs.contract_id = c.id and cs.studio_id = p_studio_id)
      )
    order by c.trainer_id, c.valid_from desc;
end;
$$;

-- Vertretung nur durch Trainer:innen, die für das Studio freigegeben sind.
create or replace function check_substitute_cleared()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_studio_id uuid;
begin
  select cp.studio_id into v_studio_id
  from course_plan_slots sl
  join course_plans cp on cp.id = sl.course_plan_id
  where sl.id = new.course_plan_slot_id;

  if not exists (
    select 1
    from contracts c
    join studios s on s.company_id = c.company_id
    where s.id = v_studio_id
      and c.trainer_id = new.substitute_trainer_id
      and c.status = 'active'
      and c.approval_status = 'approved'
      and (c.valid_to is null or c.valid_to >= new.date)
      and (
        not exists (select 1 from contract_studios cs where cs.contract_id = c.id)
        or exists (select 1 from contract_studios cs where cs.contract_id = c.id and cs.studio_id = v_studio_id)
      )
  ) then
    raise exception 'substitute_not_cleared_for_studio';
  end if;

  return new;
end;
$$;

drop trigger if exists substitute_assignments_cleared on substitute_assignments;
create trigger substitute_assignments_cleared
  before insert or update of substitute_trainer_id, date, course_plan_slot_id on substitute_assignments
  for each row execute function check_substitute_cleared();

-- ─────────────────────────────────────────────────────────────────
-- 4. Kurstypen durch Studio-Admins (mit optionaler Bestätigung)
-- ─────────────────────────────────────────────────────────────────

alter table course_types
  add column approval_status text not null default 'approved'
    check (approval_status in ('approved', 'pending_approval')),
  -- Vorgeschlagene Änderung an einem bestätigten Kurstyp:
  -- {"name", "default_duration_min", "studio_ids"} oder {"delete": true}
  add column pending_change jsonb,
  add column requested_by uuid references profiles(id) on delete set null,
  add column requested_at timestamptz;

-- Trainer:innen sehen nur bestätigte Kurstypen.
drop policy if exists "course_types: trainer mit aktivem contract" on course_types;
create policy "course_types: trainer mit aktivem contract"
  on course_types for select
  using (approval_status = 'approved' and has_active_contract(auth.uid(), company_id));

-- Noch nicht bestätigte Kurstypen können nicht eingeplant oder erfasst werden.
create or replace function check_course_type_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.course_type_id is not null and exists (
    select 1 from course_types
    where id = new.course_type_id and approval_status <> 'approved'
  ) then
    raise exception 'course_type_not_approved';
  end if;
  return new;
end;
$$;

drop trigger if exists course_plan_slots_course_type_approved on course_plan_slots;
create trigger course_plan_slots_course_type_approved
  before insert or update of course_type_id on course_plan_slots
  for each row execute function check_course_type_approved();

drop trigger if exists course_sessions_course_type_approved on course_sessions;
create trigger course_sessions_course_type_approved
  before insert or update of course_type_id on course_sessions
  for each row execute function check_course_type_approved();

-- Ein Studio-Admin darf nur Kurstypen bearbeiten, die ausschließlich seinen Studios
-- zugeordnet sind (company-weite Kurstypen bleiben beim Company-Admin).
create or replace function studio_admin_owns_studios(p_studio_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_studio_ids is not null
     and cardinality(p_studio_ids) > 0
     and not exists (select 1 from unnest(p_studio_ids) sid where not is_studio_coordinator(sid));
$$;

create or replace function studio_admin_save_course_type(
  target_company_id uuid,
  p_course_type_id uuid,
  p_name text,
  p_default_duration_min integer,
  p_studio_ids uuid[]
)
returns table (id uuid, approval_status text, pending boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permission text;
  v_ct course_types%rowtype;
  v_current_studios uuid[];
  v_id uuid;
  v_sid uuid;
begin
  if not is_company_coordinator(target_company_id) then
    raise exception 'not_authorized';
  end if;

  v_permission := studio_admin_permission(target_company_id, 'course_types');
  if v_permission = 'denied' then
    raise exception 'not_authorized';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name_required';
  end if;
  if p_default_duration_min is null or p_default_duration_min <= 0 then
    raise exception 'invalid_duration';
  end if;

  if not studio_admin_owns_studios(p_studio_ids) then
    raise exception 'course_type_studios_not_managed';
  end if;
  foreach v_sid in array p_studio_ids loop
    if not exists (select 1 from studios where studios.id = v_sid and company_id = target_company_id) then
      raise exception 'course_type_studio_company_mismatch';
    end if;
  end loop;

  if p_course_type_id is not null then
    select * into v_ct from course_types where course_types.id = p_course_type_id for update;
    if not found or v_ct.company_id <> target_company_id then
      raise exception 'course_type_not_found';
    end if;
    select array_agg(studio_id) into v_current_studios
    from course_type_studios where course_type_id = p_course_type_id;
    if not studio_admin_owns_studios(v_current_studios) then
      raise exception 'course_type_studios_not_managed';
    end if;
  end if;

  -- Direkt speichern: Recht „darf“ oder ein eigener, noch unbestätigter Vorschlag.
  if v_permission = 'allowed' or (p_course_type_id is not null and v_ct.approval_status = 'pending_approval') then
    if p_course_type_id is null then
      insert into course_types (company_id, name, default_duration_min)
      values (target_company_id, trim(p_name), p_default_duration_min)
      returning course_types.id into v_id;
    else
      v_id := p_course_type_id;
      update course_types
      set name = trim(p_name),
          default_duration_min = p_default_duration_min,
          pending_change = null,
          requested_by = case when course_types.approval_status = 'pending_approval' then auth.uid() else null end,
          requested_at = case when course_types.approval_status = 'pending_approval' then now() else null end
      where course_types.id = v_id;
    end if;

    delete from course_type_studios where course_type_id = v_id;
    insert into course_type_studios (course_type_id, studio_id)
    select v_id, sid from unnest(p_studio_ids) sid on conflict do nothing;

    return query select v_id, ct.approval_status, ct.approval_status <> 'approved'
                 from course_types ct where ct.id = v_id;
    return;
  end if;

  -- Recht „mit Bestätigung“
  if p_course_type_id is null then
    insert into course_types (company_id, name, default_duration_min, approval_status, requested_by, requested_at)
    values (target_company_id, trim(p_name), p_default_duration_min, 'pending_approval', auth.uid(), now())
    returning course_types.id into v_id;

    insert into course_type_studios (course_type_id, studio_id)
    select v_id, sid from unnest(p_studio_ids) sid on conflict do nothing;

    return query select v_id, 'pending_approval'::text, true;
    return;
  end if;

  update course_types
  set pending_change = jsonb_build_object(
        'name', trim(p_name),
        'default_duration_min', p_default_duration_min,
        'studio_ids', to_jsonb(p_studio_ids)
      ),
      requested_by = auth.uid(),
      requested_at = now()
  where course_types.id = p_course_type_id;

  return query select p_course_type_id, 'approved'::text, true;
end;
$$;

create or replace function studio_admin_delete_course_type(p_course_type_id uuid)
returns boolean -- true = gelöscht, false = Löschung wartet auf Bestätigung
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ct course_types%rowtype;
  v_permission text;
  v_current_studios uuid[];
begin
  select * into v_ct from course_types where id = p_course_type_id for update;
  if not found then
    raise exception 'course_type_not_found';
  end if;

  if not is_company_coordinator(v_ct.company_id) then
    raise exception 'not_authorized';
  end if;

  v_permission := studio_admin_permission(v_ct.company_id, 'course_types');
  if v_permission = 'denied' then
    raise exception 'not_authorized';
  end if;

  select array_agg(studio_id) into v_current_studios
  from course_type_studios where course_type_id = p_course_type_id;
  if not studio_admin_owns_studios(v_current_studios) then
    raise exception 'course_type_studios_not_managed';
  end if;

  if v_permission = 'allowed' or v_ct.approval_status = 'pending_approval' then
    delete from course_types where id = p_course_type_id;
    return true;
  end if;

  update course_types
  set pending_change = jsonb_build_object('delete', true),
      requested_by = auth.uid(),
      requested_at = now()
  where id = p_course_type_id;
  return false;
end;
$$;

-- Company-Admin bestätigt oder verwirft einen Kurstyp-Vorschlag eines Studio-Admins.
create or replace function review_course_type(p_course_type_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ct course_types%rowtype;
  v_studios uuid[];
begin
  select * into v_ct from course_types where id = p_course_type_id for update;
  if not found then
    raise exception 'course_type_not_found';
  end if;

  if not (is_platform_admin() or is_company_admin(v_ct.company_id)) then
    raise exception 'not_authorized';
  end if;

  if v_ct.approval_status = 'pending_approval' then
    if p_approve then
      update course_types
      set approval_status = 'approved', requested_by = null, requested_at = null, pending_change = null
      where id = p_course_type_id;
    else
      delete from course_types where id = p_course_type_id;
    end if;
    return;
  end if;

  if v_ct.pending_change is null then
    raise exception 'course_type_not_awaiting_approval';
  end if;

  if not p_approve then
    update course_types
    set pending_change = null, requested_by = null, requested_at = null
    where id = p_course_type_id;
    return;
  end if;

  if coalesce((v_ct.pending_change ->> 'delete')::boolean, false) then
    delete from course_types where id = p_course_type_id;
    return;
  end if;

  update course_types
  set name = v_ct.pending_change ->> 'name',
      default_duration_min = (v_ct.pending_change ->> 'default_duration_min')::integer,
      pending_change = null, requested_by = null, requested_at = null
  where id = p_course_type_id;

  select array_agg(value::uuid) into v_studios
  from jsonb_array_elements_text(v_ct.pending_change -> 'studio_ids');

  delete from course_type_studios where course_type_id = p_course_type_id;
  if v_studios is not null then
    insert into course_type_studios (course_type_id, studio_id)
    select p_course_type_id, sid from unnest(v_studios) sid on conflict do nothing;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 5. Abrechnung bei nicht getrennter Abrechnung
-- ─────────────────────────────────────────────────────────────────

create or replace function billing_can_issue(p_company_id uuid, p_studio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when (billing_settings_for(p_company_id)).split_by_studio then
      p_studio_id is not null
      and exists (select 1 from studios where id = p_studio_id and company_id = p_company_id)
      and can_manage_studio(p_studio_id)
    else
      p_studio_id is null
      and (
        is_platform_admin()
        or is_company_admin(p_company_id)
        or (is_company_coordinator(p_company_id)
            and studio_admin_permission(p_company_id, 'billing') = 'allowed')
      )
  end;
$$;

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
  if v_doc.studio_id is null
     and is_company_coordinator(v_doc.company_id)
     and studio_admin_permission(v_doc.company_id, 'billing') = 'allowed' then
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

-- ─────────────────────────────────────────────────────────────────
-- 6. Mehrere Plattform-Admins
-- ─────────────────────────────────────────────────────────────────

create or replace function get_platform_admins()
returns table (user_id uuid, email text, full_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  return query
    select pa.user_id, u.email::text, p.full_name, pa.created_at
    from platform_admins pa
    join auth.users u on u.id = pa.user_id
    left join profiles p on p.id = pa.user_id
    order by pa.created_at asc;
end;
$$;

create or replace function add_platform_admin(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(target_email));
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into platform_admins (user_id) values (v_user_id)
  on conflict (user_id) do nothing;

  return v_user_id;
end;
$$;

create or replace function remove_platform_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  perform 1 from platform_admins for update;
  if (select count(*) from platform_admins) <= 1 then
    raise exception 'last_platform_admin';
  end if;

  delete from platform_admins where user_id = target_user_id;
  if not found then
    raise exception 'platform_admin_not_found';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RECHTE
-- ─────────────────────────────────────────────────────────────────

revoke all on function
  guard_contract_approval(),
  check_substitute_cleared(),
  check_course_type_approved()
from public, anon, authenticated;

-- Helfer, die in RLS-Policies stecken, brauchen execute für authenticated.
revoke all on function
  studio_admin_permission(uuid, text),
  trainer_cleared_for_studio(uuid, uuid, date),
  studio_admin_owns_studios(uuid[]),
  coordinator_can_access_contract(uuid),
  billing_can_issue(uuid, uuid),
  billing_document_access(uuid),
  get_studio_admin_permissions(uuid),
  set_studio_admin_permissions(uuid, text, text, text),
  offer_contract(uuid, text, text, text, numeric, date, date, uuid[]),
  review_contract(uuid, boolean, uuid[]),
  set_contract_studios(uuid, uuid[]),
  get_my_contracts(),
  get_company_contracts(uuid),
  get_trainer_studios(),
  get_trainer_studio_slots(),
  get_company_colleagues(uuid, uuid),
  studio_admin_save_course_type(uuid, uuid, text, integer, uuid[]),
  studio_admin_delete_course_type(uuid),
  review_course_type(uuid, boolean),
  get_platform_admins(),
  add_platform_admin(text),
  remove_platform_admin(uuid)
from public, anon;

grant execute on function
  studio_admin_permission(uuid, text),
  trainer_cleared_for_studio(uuid, uuid, date),
  studio_admin_owns_studios(uuid[]),
  coordinator_can_access_contract(uuid),
  get_studio_admin_permissions(uuid),
  set_studio_admin_permissions(uuid, text, text, text),
  offer_contract(uuid, text, text, text, numeric, date, date, uuid[]),
  review_contract(uuid, boolean, uuid[]),
  set_contract_studios(uuid, uuid[]),
  get_my_contracts(),
  get_company_contracts(uuid),
  get_trainer_studios(),
  get_trainer_studio_slots(),
  get_company_colleagues(uuid, uuid),
  studio_admin_save_course_type(uuid, uuid, text, integer, uuid[]),
  studio_admin_delete_course_type(uuid),
  review_course_type(uuid, boolean),
  get_platform_admins(),
  add_platform_admin(text),
  remove_platform_admin(uuid)
to authenticated;

grant select on studio_admin_permissions to authenticated;

notify pgrst, 'reload schema';
