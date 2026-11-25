-- Erweiterung der Vertrags-Vergütungsmodelle um `per_minute` (pro Minute)
-- sowie optionale Studio-Einschränkung für company-weite Kurstypen (`course_type_studios`).
-- Semantik `course_type_studios`: keine Zeilen für einen Kurstyp = in allen Studios der Company verfügbar.

alter table contracts
  drop constraint if exists contracts_rate_model_check;

alter table contracts
  add constraint contracts_rate_model_check
  check (rate_model in ('per_course', 'hourly', 'per_minute', 'fixed'));

create table course_type_studios (
  course_type_id uuid not null references course_types(id) on delete cascade,
  studio_id      uuid not null references studios(id) on delete cascade,
  primary key (course_type_id, studio_id)
);

create index course_type_studios_studio_idx on course_type_studios (studio_id);

-- Sicherstellen, dass Kurstyp und Studio zur selben Company gehören.
create or replace function check_course_type_studio_same_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ct_company uuid;
  v_studio_company uuid;
begin
  select company_id into v_ct_company from course_types where id = new.course_type_id;
  select company_id into v_studio_company from studios where id = new.studio_id;

  if v_ct_company is null or v_studio_company is null or v_ct_company <> v_studio_company then
    raise exception 'course_type_studio_company_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists course_type_studios_company_check on course_type_studios;
create trigger course_type_studios_company_check
  before insert or update on course_type_studios
  for each row
  execute function check_course_type_studio_same_company();

alter table course_type_studios enable row level security;

create policy "course_type_studios: company_admin/platform_admin/trainer lesen"
  on course_type_studios for select
  using (
    is_platform_admin()
    or is_company_admin((select company_id from course_types where id = course_type_studios.course_type_id))
    or has_active_contract(auth.uid(), (select company_id from course_types where id = course_type_studios.course_type_id))
  );

create policy "course_type_studios: company_admin/platform_admin verwalten"
  on course_type_studios for all
  using (
    is_platform_admin()
    or is_company_admin((select company_id from course_types where id = course_type_studios.course_type_id))
  )
  with check (
    is_platform_admin()
    or is_company_admin((select company_id from course_types where id = course_type_studios.course_type_id))
  );

-- Atomares Setzen der optionalen Studio-Einschränkung eines Kurstyps.
-- Leeres Array (oder NULL) = company-weit in allen Studios verfügbar.
create or replace function set_course_type_studios(
  p_course_type_id uuid,
  p_studio_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_sid uuid;
begin
  select company_id into v_company_id
  from course_types
  where id = p_course_type_id;

  if v_company_id is null then
    raise exception 'course_type_not_found';
  end if;

  if not (is_company_admin(v_company_id) or is_platform_admin()) then
    raise exception 'not_authorized';
  end if;

  delete from course_type_studios
  where course_type_id = p_course_type_id;

  if p_studio_ids is not null and array_length(p_studio_ids, 1) > 0 then
    foreach v_sid in array p_studio_ids
    loop
      if not exists (
        select 1 from studios
        where id = v_sid and company_id = v_company_id
      ) then
        raise exception 'course_type_studio_company_mismatch';
      end if;

      insert into course_type_studios (course_type_id, studio_id)
      values (p_course_type_id, v_sid)
      on conflict do nothing;
    end loop;
  end if;
end;
$$;

-- `publish_course_plan` prüft zusätzlich die optionale Studio-Einschränkung des Kurstyps.
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
  check_course_type_studio_same_company(),
  set_course_type_studios(uuid, uuid[])
from public, anon;

grant execute on function
  set_course_type_studios(uuid, uuid[])
to authenticated;

notify pgrst, 'reload schema';
