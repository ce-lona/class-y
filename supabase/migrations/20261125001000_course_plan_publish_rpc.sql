-- Schritt 2b: Kurstypen & atomare Kursplan-Versionierung (Archivieren + Neuanlage).
-- Alle Funktionen sind ausschließlich für `authenticated` ausführbar, nie für `anon`.

alter table course_types
  add constraint course_types_duration_positive check (default_duration_min > 0);

-- Aktive Trainer:innen einer Company (inkl. E-Mail-Fallback, falls full_name noch leer ist).
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
begin
  if not (is_company_admin(target_company_id) or is_platform_admin()) then
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
    order by c.trainer_id, c.valid_from desc;
end;
$$;

-- Detaillierte Slots eines Kursplans (für Studio-Admins & Trainer:innen mit aktivem Vertrag).
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
begin
  select s.company_id into v_company_id
  from course_plans cp
  join studios s on s.id = cp.studio_id
  where cp.id = target_plan_id;

  if v_company_id is null then
    return;
  end if;

  if not (
    is_platform_admin()
    or is_company_admin(v_company_id)
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

-- Veröffentlicht atomar eine neue Kursplan-Version:
-- 1. Bestehenden aktiven Plan des Studios archivieren (valid_to = Vortag bzw. mind. valid_from)
-- 2. Neuen aktiven Plan anlegen
-- 3. Alle Slots validieren (Kurstyp gehört zur Company, Trainer hat aktiven Vertrag) und speichern
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

  if not (is_company_admin(v_company_id) or is_platform_admin()) then
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

    if not exists (
      select 1 from contracts c
      where c.trainer_id = v_trainer_id
        and c.company_id = v_company_id
        and c.status = 'active'
        and (c.valid_to is null or c.valid_to >= p_valid_from)
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

revoke all on function
  get_company_active_trainers(uuid),
  get_plan_slots_detailed(uuid),
  publish_course_plan(uuid, date, jsonb)
from public, anon;

grant execute on function
  get_company_active_trainers(uuid),
  get_plan_slots_detailed(uuid),
  publish_course_plan(uuid, date, jsonb)
to authenticated;

notify pgrst, 'reload schema';
