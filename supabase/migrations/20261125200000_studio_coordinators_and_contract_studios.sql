-- Kurskoordinatoren (`studio_coordinators`) & optionale Studio-Zuordnung für Verträge (`contract_studios`).
-- Ein Company-Admin kann Kurskoordinatoren exklusiv für ausgewählte Studios ermächtigen.
-- Koordinatoren verwalten ausschließlich ihre zugewiesenen Studios — inkl. Stundenpläne,
-- Monitoring und Trainer-Verträge/Honorare der jeweiligen Studios.

create table studio_coordinators (
  user_id    uuid not null references profiles(id) on delete cascade,
  studio_id  uuid not null references studios(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, studio_id)
);

create index studio_coordinators_studio_idx on studio_coordinators (studio_id);

create table contract_studios (
  contract_id uuid not null references contracts(id) on delete cascade,
  studio_id   uuid not null references studios(id) on delete cascade,
  primary key (contract_id, studio_id)
);

create index contract_studios_studio_idx on contract_studios (studio_id);

create or replace function check_contract_studio_same_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c_company uuid;
  v_s_company uuid;
begin
  select company_id into v_c_company from contracts where id = new.contract_id;
  select company_id into v_s_company from studios where id = new.studio_id;
  if v_c_company is null or v_s_company is null or v_c_company <> v_s_company then
    raise exception 'contract_studio_company_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists contract_studios_company_check on contract_studios;
create trigger contract_studios_company_check
  before insert or update on contract_studios
  for each row execute function check_contract_studio_same_company();

-- ─────────────────────────────────────────────────────────────────
-- Helper-Funktionen (security definer, search_path = public)
-- ─────────────────────────────────────────────────────────────────

create or replace function is_studio_coordinator(target_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from studio_coordinators
    where user_id = auth.uid()
      and studio_id = target_studio_id
  );
$$;

create or replace function is_company_coordinator(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from studio_coordinators sc
    join studios s on s.id = sc.studio_id
    where sc.user_id = auth.uid()
      and s.company_id = target_company_id
  );
$$;

create or replace function can_manage_studio(target_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_platform_admin()
    or is_company_admin((select company_id from studios where id = target_studio_id))
    or is_studio_coordinator(target_studio_id);
$$;

-- Ein Koordinator darf einen Vertrag sehen/verwalten, wenn der Vertrag ausdrücklich
-- einem seiner Studios zugeordnet ist ODER die Trainer:in in einem Kursplan eines
-- seiner Studios eingeteilt ist (sofern der Vertrag nicht exklusiv auf andere Studios begrenzt ist).
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
      and (
        exists (
          select 1
          from contract_studios cs
          join studio_coordinators sc
            on sc.studio_id = cs.studio_id
           and sc.user_id = auth.uid()
          where cs.contract_id = c.id
        )
        or (
          not exists (select 1 from contract_studios cs where cs.contract_id = c.id)
          and exists (
            select 1
            from course_plan_slots sl
            join course_plans cp on cp.id = sl.course_plan_id
            join studio_coordinators sc
              on sc.studio_id = cp.studio_id
             and sc.user_id = auth.uid()
            where sl.trainer_id = c.trainer_id
          )
        )
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────────
-- RLS für neue Tabellen + Erweiterung bestehender Policies für Koordinatoren
-- ─────────────────────────────────────────────────────────────────

alter table studio_coordinators enable row level security;

create policy "studio_coordinators: eigene oder company_admin/platform_admin lesen"
  on studio_coordinators for select
  using (
    user_id = auth.uid()
    or is_platform_admin()
    or is_company_admin((select company_id from studios where id = studio_coordinators.studio_id))
  );

create policy "studio_coordinators: company_admin/platform_admin verwalten"
  on studio_coordinators for all
  using (
    is_platform_admin()
    or is_company_admin((select company_id from studios where id = studio_coordinators.studio_id))
  )
  with check (
    is_platform_admin()
    or is_company_admin((select company_id from studios where id = studio_coordinators.studio_id))
  );

alter table contract_studios enable row level security;

create policy "contract_studios: beteiligte, admins und koordinatoren lesen"
  on contract_studios for select
  using (
    is_platform_admin()
    or is_company_admin((select company_id from contracts where id = contract_studios.contract_id))
    or is_studio_coordinator(studio_id)
    or exists (
      select 1 from contracts c
      where c.id = contract_studios.contract_id
        and c.trainer_id = auth.uid()
    )
  );

-- Direkte Schreibrechte nur für company_admin/platform_admin. Koordinatoren ordnen Studios
-- ausschließlich über offer_contract (security definer) zu. Sonst könnte eine Koordinator:in
-- beliebige Verträge der Company mit dem eigenen Studio verknüpfen und so fremde Honorare sehen.
create policy "contract_studios: admins verwalten"
  on contract_studios for all
  using (
    is_platform_admin()
    or is_company_admin((select company_id from contracts where id = contract_studios.contract_id))
  )
  with check (
    is_platform_admin()
    or is_company_admin((select company_id from contracts where id = contract_studios.contract_id))
  );

-- Bestehende Tabellen: Koordinatoren erhalten Zugriff ausschließlich auf ihre Studios.
create policy "companies: coordinator lesen"
  on companies for select
  using (is_company_coordinator(id));

create policy "studios: coordinator lesen"
  on studios for select
  using (is_studio_coordinator(id));

create policy "studios: coordinator bearbeiten"
  on studios for update
  using (is_studio_coordinator(id))
  with check (is_studio_coordinator(id));

create policy "course_types: coordinator lesen"
  on course_types for select
  using (is_company_coordinator(company_id));

create policy "course_type_studios: coordinator lesen"
  on course_type_studios for select
  using (is_company_coordinator((select company_id from course_types where id = course_type_studios.course_type_id)));

create policy "course_plans: coordinator lesen"
  on course_plans for select
  using (is_studio_coordinator(studio_id));

create policy "course_plan_slots: coordinator lesen"
  on course_plan_slots for select
  using (
    is_studio_coordinator((select studio_id from course_plans where id = course_plan_slots.course_plan_id))
  );

create policy "course_sessions: coordinator verwalten"
  on course_sessions for all
  using (is_studio_coordinator(studio_id))
  with check (is_studio_coordinator(studio_id));

create policy "contracts: coordinator lesen"
  on contracts for select
  using (coordinator_can_access_contract(id));

create policy "contracts: coordinator bearbeiten"
  on contracts for update
  using (coordinator_can_access_contract(id))
  with check (coordinator_can_access_contract(id));

create policy "substitute_assignments: coordinator lesen"
  on substitute_assignments for select
  using (
    is_studio_coordinator((
      select cp.studio_id
      from course_plan_slots sl
      join course_plans cp on cp.id = sl.course_plan_id
      where sl.id = substitute_assignments.course_plan_slot_id
    ))
  );

-- ─────────────────────────────────────────────────────────────────
-- RPCs für Rollen/Kontext & Koordinator-Verwaltung
-- ─────────────────────────────────────────────────────────────────

-- Liefert alle Companies, in denen der eingeloggte Nutzer Company-Admin ODER Kurskoordinator ist.
create or replace function get_my_managed_companies()
returns table (
  id uuid,
  name text,
  street text,
  house_number text,
  postal_code text,
  city text,
  country text,
  created_at timestamptz,
  role text,
  studio_ids uuid[]
)
language sql
stable
security definer
set search_path = public
as $$
  with admin_companies as (
    select
      c.id, c.name, c.street, c.house_number, c.postal_code, c.city, c.country, c.created_at,
      'company_admin'::text as role,
      null::uuid[] as studio_ids
    from company_admins ca
    join companies c on c.id = ca.company_id
    where ca.user_id = auth.uid()
  ),
  coord_companies as (
    select
      c.id, c.name, c.street, c.house_number, c.postal_code, c.city, c.country, c.created_at,
      'coordinator'::text as role,
      array_agg(distinct s.id order by s.id) as studio_ids
    from studio_coordinators sc
    join studios s on s.id = sc.studio_id
    join companies c on c.id = s.company_id
    where sc.user_id = auth.uid()
      and not exists (
        select 1 from admin_companies ac where ac.id = c.id
      )
    group by c.id, c.name, c.street, c.house_number, c.postal_code, c.city, c.country, c.created_at
  )
  select * from admin_companies
  union all
  select * from coord_companies
  order by name asc;
$$;

-- Liste aller Kurskoordinatoren einer Company (nur für Company-Admin / Platform-Admin).
create or replace function get_company_coordinators(target_company_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  studio_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (is_company_admin(target_company_id) or is_platform_admin()) then
    raise exception 'not_authorized';
  end if;

  return query
    select
      sc.user_id,
      u.email::text,
      p.full_name,
      array_agg(sc.studio_id order by s.name) as studio_ids
    from studio_coordinators sc
    join studios s on s.id = sc.studio_id
    join auth.users u on u.id = sc.user_id
    left join profiles p on p.id = sc.user_id
    where s.company_id = target_company_id
    group by sc.user_id, u.email, p.full_name
    order by coalesce(p.full_name, u.email::text) asc;
end;
$$;

-- Setzt die exklusiven Studio-Rechte einer Kurskoordinator:in (leeres Array = Rechte in dieser Company entziehen).
create or replace function set_studio_coordinator_studios(
  target_company_id uuid,
  target_email text,
  p_studio_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_sid uuid;
begin
  if not (is_company_admin(target_company_id) or is_platform_admin()) then
    raise exception 'not_authorized';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(target_email));

  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  delete from studio_coordinators sc
  using studios s
  where sc.studio_id = s.id
    and s.company_id = target_company_id
    and sc.user_id = v_user_id;

  if p_studio_ids is not null and array_length(p_studio_ids, 1) > 0 then
    foreach v_sid in array p_studio_ids
    loop
      if not exists (
        select 1 from studios where id = v_sid and company_id = target_company_id
      ) then
        raise exception 'studio_company_mismatch';
      end if;

      insert into studio_coordinators (user_id, studio_id)
      values (v_user_id, v_sid)
      on conflict do nothing;
    end loop;
  end if;

  return v_user_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Bestehende RPCs für Kurskoordinatoren erweitern (strikt auf zugewiesene Studios begrenzt)
-- ─────────────────────────────────────────────────────────────────

-- 1. offer_contract: optional p_studio_ids; Koordinatoren dürfen nur Verträge für eigene Studios anbieten.
drop function if exists offer_contract(uuid, text, text, text, numeric, date, date);

create or replace function offer_contract(
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
  v_effective_studios uuid[];
  v_sid uuid;
begin
  v_is_full_admin := is_platform_admin() or is_company_admin(target_company_id);

  if not (v_is_full_admin or is_company_coordinator(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  if v_is_full_admin then
    v_effective_studios := p_studio_ids;
    if v_effective_studios is not null and array_length(v_effective_studios, 1) > 0 then
      foreach v_sid in array v_effective_studios loop
        if not exists (select 1 from studios where id = v_sid and company_id = target_company_id) then
          raise exception 'contract_studio_company_mismatch';
        end if;
      end loop;
    end if;
  else
    -- Koordinator: falls kein Studio angegeben, alle eigenen Studios dieser Company verwenden;
    -- falls angegeben, muss jedes Studio vom Koordinator verwaltet werden.
    if p_studio_ids is null or array_length(p_studio_ids, 1) is null then
      select array_agg(sc.studio_id)
      into v_effective_studios
      from studio_coordinators sc
      join studios s on s.id = sc.studio_id
      where sc.user_id = auth.uid()
        and s.company_id = target_company_id;
    else
      v_effective_studios := p_studio_ids;
    end if;

    if v_effective_studios is null or array_length(v_effective_studios, 1) is null then
      raise exception 'not_authorized';
    end if;

    foreach v_sid in array v_effective_studios loop
      if not exists (
        select 1
        from studio_coordinators sc
        join studios s on s.id = sc.studio_id
        where sc.user_id = auth.uid()
          and sc.studio_id = v_sid
          and s.company_id = target_company_id
      ) then
        raise exception 'not_authorized';
      end if;
    end loop;
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(target_email);
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into contracts (
    trainer_id, company_id, employment_type, rate_model, rate_amount, valid_from, valid_to, status
  ) values (
    v_user_id, target_company_id, p_employment_type, p_rate_model, p_rate_amount,
    p_valid_from, p_valid_to, 'pending'
  )
  returning id into v_contract_id;

  if v_effective_studios is not null and array_length(v_effective_studios, 1) > 0 then
    foreach v_sid in array v_effective_studios loop
      insert into contract_studios (contract_id, studio_id)
      values (v_contract_id, v_sid)
      on conflict do nothing;
    end loop;
  end if;

  return v_contract_id;
end;
$$;

-- 2. get_company_contracts: liefert studio_ids mit zurück; Koordinatoren sehen nur Verträge ihrer Studios.
drop function if exists get_company_contracts(uuid);

create or replace function get_company_contracts(target_company_id uuid)
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
  studio_ids uuid[]
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
      ) as studio_ids
    from contracts c
    join auth.users u on u.id = c.trainer_id
    left join profiles p on p.id = c.trainer_id
    where c.company_id = target_company_id
      and (v_is_full_admin or coordinator_can_access_contract(c.id))
    order by c.created_at desc;
end;
$$;

-- 3. get_company_active_trainers: Koordinatoren sehen nur aktive Trainer:innen ihrer Studios.
create or replace function get_company_active_trainers(target_company_id uuid)
returns table (
  trainer_id uuid,
  full_name text,
  email text
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
    select distinct on (c.trainer_id)
      c.trainer_id,
      p.full_name,
      u.email::text
    from contracts c
    join auth.users u on u.id = c.trainer_id
    left join profiles p on p.id = c.trainer_id
    where c.company_id = target_company_id
      and c.status = 'active'
      and (c.valid_to is null or c.valid_to >= current_date)
      and (v_is_full_admin or coordinator_can_access_contract(c.id))
    order by c.trainer_id, c.valid_from desc;
end;
$$;

-- 4. get_plan_slots_detailed: auch für Koordinatoren des jeweiligen Studios erlauben.
create or replace function get_plan_slots_detailed(target_plan_id uuid)
returns table (
  id uuid,
  course_plan_id uuid,
  weekday smallint,
  start_time time,
  end_time time,
  course_type_id uuid,
  course_type_name text,
  course_type_duration_min integer,
  trainer_id uuid,
  trainer_name text,
  trainer_email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_studio_id uuid;
begin
  select s.company_id, cp.studio_id into v_company_id, v_studio_id
  from course_plans cp
  join studios s on s.id = cp.studio_id
  where cp.id = target_plan_id;

  if v_company_id is null then
    return;
  end if;

  if not (
    is_platform_admin()
    or is_company_admin(v_company_id)
    or is_studio_coordinator(v_studio_id)
    or has_active_contract(auth.uid(), v_company_id)
  ) then
    raise exception 'not_authorized';
  end if;

  return query
    select
      sl.id,
      sl.course_plan_id,
      sl.weekday,
      sl.start_time,
      sl.end_time,
      sl.course_type_id,
      ct.name as course_type_name,
      ct.default_duration_min as course_type_duration_min,
      sl.trainer_id,
      p.full_name as trainer_name,
      u.email::text as trainer_email
    from course_plan_slots sl
    join course_types ct on ct.id = sl.course_type_id
    join auth.users u on u.id = sl.trainer_id
    left join profiles p on p.id = sl.trainer_id
    where sl.course_plan_id = target_plan_id
    order by sl.weekday asc, sl.start_time asc, sl.end_time asc;
end;
$$;

-- 5. publish_course_plan: erlaubt auch Kurskoordinatoren des Ziel-Studios.
create or replace function publish_course_plan(
  target_studio_id uuid,
  p_valid_from date,
  p_slots jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_plan_id uuid;
  v_slot jsonb;
  v_weekday smallint;
  v_start_time time;
  v_end_time time;
  v_course_type_id uuid;
  v_trainer_id uuid;
begin
  select company_id into v_company_id
  from studios
  where id = target_studio_id;

  if v_company_id is null then
    raise exception 'studio_not_found';
  end if;

  if not can_manage_studio(target_studio_id) then
    raise exception 'not_authorized';
  end if;

  if p_valid_from is null then
    raise exception 'valid_from_required';
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'slots_required';
  end if;

  update course_plans
  set status = 'archived',
      valid_to = greatest(valid_from, p_valid_from - 1)
  where studio_id = target_studio_id
    and status = 'active';

  insert into course_plans (studio_id, valid_from, valid_to, status, created_by)
  values (target_studio_id, p_valid_from, null, 'active', auth.uid())
  returning id into v_plan_id;

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    v_weekday := (v_slot->>'weekday')::smallint;
    v_start_time := (v_slot->>'start_time')::time;
    v_end_time := (v_slot->>'end_time')::time;
    v_course_type_id := (v_slot->>'course_type_id')::uuid;
    v_trainer_id := (v_slot->>'trainer_id')::uuid;

    if v_weekday is null or v_weekday < 1 or v_weekday > 7 then
      raise exception 'invalid_weekday';
    end if;

    if v_start_time is null or v_end_time is null or v_end_time <= v_start_time then
      raise exception 'invalid_time_range';
    end if;

    if not exists (
      select 1 from course_types
      where id = v_course_type_id
        and company_id = v_company_id
    ) then
      raise exception 'course_type_company_mismatch';
    end if;

    if exists (
      select 1 from course_type_studios
      where course_type_id = v_course_type_id
    ) and not exists (
      select 1 from course_type_studios
      where course_type_id = v_course_type_id
        and studio_id = target_studio_id
    ) then
      raise exception 'course_type_studio_mismatch';
    end if;

    if not exists (
      select 1 from contracts c
      where c.trainer_id = v_trainer_id
        and c.company_id = v_company_id
        and c.status = 'active'
        and (c.valid_to is null or c.valid_to >= p_valid_from)
        and (
          not exists (select 1 from contract_studios cs where cs.contract_id = c.id)
          or exists (
            select 1 from contract_studios cs
            where cs.contract_id = c.id
              and cs.studio_id = target_studio_id
          )
        )
    ) then
      raise exception 'trainer_without_active_contract';
    end if;

    insert into course_plan_slots (
      course_plan_id,
      weekday,
      start_time,
      end_time,
      course_type_id,
      trainer_id
    )
    values (
      v_plan_id,
      v_weekday,
      v_start_time,
      v_end_time,
      v_course_type_id,
      v_trainer_id
    );
  end loop;

  return v_plan_id;
end;
$$;

-- 6. get_company_monitoring: Koordinatoren sehen strikt nur ihre zugewiesenen Studios.
create or replace function get_company_monitoring(
  target_company_id uuid,
  p_from date,
  p_to date,
  p_studio_id uuid default null
)
returns table (
  row_key text,
  session_id uuid,
  course_plan_slot_id uuid,
  studio_id uuid,
  studio_name text,
  course_date date,
  start_time time,
  end_time time,
  course_type_id uuid,
  course_type_name text,
  trainer_id uuid,
  trainer_name text,
  trainer_email text,
  scheduled_trainer_name text,
  is_substitution boolean,
  is_ad_hoc boolean,
  status text,
  notes text,
  employment_type text,
  rate_model text,
  rate_amount numeric,
  pending_substitute_name text
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

  if not v_is_full_admin and p_studio_id is not null and not is_studio_coordinator(p_studio_id) then
    raise exception 'not_authorized';
  end if;

  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'invalid_date_range';
  end if;

  return query
    with allowed_studios as (
      select s.id, s.name
      from studios s
      where s.company_id = target_company_id
        and (p_studio_id is null or s.id = p_studio_id)
        and (v_is_full_admin or is_studio_coordinator(s.id))
    ),
    logged as (
      select
        'session:' || cs.id::text as row_key,
        cs.id as session_id,
        cs.course_plan_slot_id,
        cs.studio_id,
        s.name as studio_name,
        cs.date as course_date,
        cs.start_time,
        cs.end_time,
        coalesce(cs.course_type_id, sl.course_type_id) as course_type_id,
        coalesce(ct.name, 'Ad-hoc') as course_type_name,
        cs.trainer_id,
        p.full_name as trainer_name,
        u.email::text as trainer_email,
        case
          when sl.trainer_id is not null and sl.trainer_id <> cs.trainer_id then
            coalesce(nullif(trim(sp.full_name), ''), split_part(su.email::text, '@', 1))
          else null
        end as scheduled_trainer_name,
        cs.is_substitution,
        (cs.course_plan_slot_id is null) as is_ad_hoc,
        cs.status,
        cs.notes,
        ct_rate.employment_type,
        ct_rate.rate_model,
        ct_rate.rate_amount,
        null::text as pending_substitute_name
      from course_sessions cs
      join allowed_studios s on s.id = cs.studio_id
      left join course_plan_slots sl on sl.id = cs.course_plan_slot_id
      left join course_types ct on ct.id = coalesce(cs.course_type_id, sl.course_type_id)
      join auth.users u on u.id = cs.trainer_id
      left join profiles p on p.id = cs.trainer_id
      left join auth.users su on su.id = sl.trainer_id
      left join profiles sp on sp.id = sl.trainer_id
      left join lateral (
        select c.employment_type, c.rate_model, c.rate_amount
        from contracts c
        where c.trainer_id = cs.trainer_id
          and c.company_id = target_company_id
          and c.status in ('active', 'ended')
          and c.valid_from <= cs.date
          and (c.valid_to is null or c.valid_to >= cs.date)
        order by (c.status = 'active') desc, c.valid_from desc, c.created_at desc
        limit 1
      ) ct_rate on true
      where cs.date between p_from and p_to
    ),
    unlogged_planned as (
      select
        'slot:' || sl.id::text || ':' || d::text as row_key,
        null::uuid as session_id,
        sl.id as course_plan_slot_id,
        s.id as studio_id,
        s.name as studio_name,
        d as course_date,
        sl.start_time,
        sl.end_time,
        sl.course_type_id,
        ct.name as course_type_name,
        eff.trainer_id,
        p.full_name as trainer_name,
        u.email::text as trainer_email,
        case
          when accepted_sa.id is not null then
            coalesce(nullif(trim(op.full_name), ''), split_part(ou.email::text, '@', 1))
          else null
        end as scheduled_trainer_name,
        (accepted_sa.id is not null) as is_substitution,
        false as is_ad_hoc,
        case
          when d < current_date then 'overdue'
          else 'planned'
        end as status,
        coalesce(accepted_sa.notes, pending_sa.notes) as notes,
        ct_rate.employment_type,
        ct_rate.rate_model,
        ct_rate.rate_amount,
        case
          when pending_sa.id is not null then
            coalesce(nullif(trim(pp.full_name), ''), split_part(pu.email::text, '@', 1))
          else null
        end as pending_substitute_name
      from generate_series(p_from, p_to, interval '1 day') as gs(day_ts)
      cross join lateral (select gs.day_ts::date as d) day_row
      join allowed_studios s on true
      join lateral (
        select cp.id
        from course_plans cp
        where cp.studio_id = s.id
          and cp.valid_from <= d
          and (cp.valid_to is null or cp.valid_to >= d)
        order by (cp.status = 'active') desc, cp.valid_from desc, cp.created_at desc
        limit 1
      ) active_cp on true
      join course_plan_slots sl
        on sl.course_plan_id = active_cp.id
        and sl.weekday = extract(isodow from d)::smallint
      left join substitute_assignments accepted_sa
        on accepted_sa.course_plan_slot_id = sl.id
        and accepted_sa.date = d
        and accepted_sa.status = 'accepted'
      left join substitute_assignments pending_sa
        on pending_sa.course_plan_slot_id = sl.id
        and pending_sa.date = d
        and pending_sa.status = 'pending'
      cross join lateral (
        select coalesce(accepted_sa.substitute_trainer_id, sl.trainer_id) as trainer_id
      ) eff
      join course_types ct on ct.id = sl.course_type_id
      join auth.users u on u.id = eff.trainer_id
      left join profiles p on p.id = eff.trainer_id
      left join auth.users ou on ou.id = sl.trainer_id
      left join profiles op on op.id = sl.trainer_id
      left join auth.users pu on pu.id = pending_sa.substitute_trainer_id
      left join profiles pp on pp.id = pending_sa.substitute_trainer_id
      left join lateral (
        select c.employment_type, c.rate_model, c.rate_amount
        from contracts c
        where c.trainer_id = eff.trainer_id
          and c.company_id = target_company_id
          and c.status in ('active', 'ended')
          and c.valid_from <= d
          and (c.valid_to is null or c.valid_to >= d)
        order by (c.status = 'active') desc, c.valid_from desc, c.created_at desc
        limit 1
      ) ct_rate on true
      where not exists (
        select 1
        from course_sessions cs
        where cs.course_plan_slot_id = sl.id
          and cs.date = d
      )
    )
    select *
    from (
      select * from logged
      union all
      select * from unlogged_planned
    ) combined
    order by combined.course_date asc, combined.start_time asc, combined.studio_name asc;
end;
$$;

-- 7. request_substitution & cancel_substitution_request: auch Koordinatoren des Studios erlauben.
create or replace function request_substitution(
  p_slot_id uuid,
  p_date date,
  p_substitute_trainer_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_studio_id uuid;
  v_original_trainer_id uuid;
  v_assignment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  select s.company_id, cp.studio_id, sl.trainer_id
  into v_company_id, v_studio_id, v_original_trainer_id
  from course_plan_slots sl
  join course_plans cp on cp.id = sl.course_plan_id
  join studios s on s.id = cp.studio_id
  where sl.id = p_slot_id;

  if v_company_id is null then
    raise exception 'slot_not_found';
  end if;

  if not (
    auth.uid() = v_original_trainer_id
    or can_manage_studio(v_studio_id)
  ) then
    raise exception 'not_authorized';
  end if;

  if p_date is null then
    raise exception 'date_required';
  end if;

  if p_substitute_trainer_id is null or p_substitute_trainer_id = v_original_trainer_id then
    raise exception 'invalid_substitute_trainer';
  end if;

  if not exists (
    select 1 from contracts c
    where c.trainer_id = p_substitute_trainer_id
      and c.company_id = v_company_id
      and c.status = 'active'
      and (c.valid_to is null or c.valid_to >= p_date)
  ) then
    raise exception 'substitute_without_active_contract';
  end if;

  insert into substitute_assignments (
    course_plan_slot_id,
    date,
    original_trainer_id,
    substitute_trainer_id,
    status,
    notes,
    requested_by
  )
  values (
    p_slot_id,
    p_date,
    v_original_trainer_id,
    p_substitute_trainer_id,
    'pending',
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

create or replace function cancel_substitution_request(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_studio_id uuid;
  v_original_trainer_id uuid;
  v_requested_by uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  select cp.studio_id, sa.original_trainer_id, sa.requested_by
  into v_studio_id, v_original_trainer_id, v_requested_by
  from substitute_assignments sa
  join course_plan_slots sl on sl.id = sa.course_plan_slot_id
  join course_plans cp on cp.id = sl.course_plan_id
  where sa.id = p_assignment_id
    and sa.status = 'pending';

  if v_studio_id is null then
    raise exception 'substitution_not_found_or_not_pending';
  end if;

  if not (
    auth.uid() = v_original_trainer_id
    or auth.uid() = v_requested_by
    or can_manage_studio(v_studio_id)
  ) then
    raise exception 'not_authorized';
  end if;

  update substitute_assignments
  set status = 'cancelled',
      responded_at = now()
  where id = p_assignment_id
    and status = 'pending';
end;
$$;

revoke all on function
  check_contract_studio_same_company(),
  is_studio_coordinator(uuid),
  is_company_coordinator(uuid),
  can_manage_studio(uuid),
  coordinator_can_access_contract(uuid),
  get_my_managed_companies(),
  get_company_coordinators(uuid),
  set_studio_coordinator_studios(uuid, text, uuid[]),
  offer_contract(uuid, text, text, text, numeric, date, date, uuid[]),
  get_company_contracts(uuid),
  get_company_active_trainers(uuid),
  get_plan_slots_detailed(uuid),
  publish_course_plan(uuid, date, jsonb),
  get_company_monitoring(uuid, date, date, uuid),
  request_substitution(uuid, date, uuid, text),
  cancel_substitution_request(uuid)
from public, anon;

grant execute on function
  is_studio_coordinator(uuid),
  is_company_coordinator(uuid),
  can_manage_studio(uuid),
  coordinator_can_access_contract(uuid),
  get_my_managed_companies(),
  get_company_coordinators(uuid),
  set_studio_coordinator_studios(uuid, text, uuid[]),
  offer_contract(uuid, text, text, text, numeric, date, date, uuid[]),
  get_company_contracts(uuid),
  get_company_active_trainers(uuid),
  get_plan_slots_detailed(uuid),
  publish_course_plan(uuid, date, jsonb),
  get_company_monitoring(uuid, date, date, uuid),
  request_substitution(uuid, date, uuid, text),
  cancel_substitution_request(uuid)
to authenticated;

grant execute on function
  offer_contract(uuid, text, text, text, numeric, date, date, uuid[]),
  get_company_contracts(uuid),
  set_studio_coordinator_studios(uuid, text, uuid[])
to service_role;

notify pgrst, 'reload schema';
