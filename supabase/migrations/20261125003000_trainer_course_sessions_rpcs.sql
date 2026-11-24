-- Schritt 2c: Kurserfassung für Trainer:innen (geplante Slots, spontane Vertretungen, Ad-hoc).
-- Alle RPCs sind ausschließlich für `authenticated` ausführbar, nie für `anon`.

-- Verhindert doppelte Erfassung desselben Plan-Slots am selben Tag durch dieselbe Trainer:in.
create unique index if not exists course_sessions_unique_slot_date_trainer
  on course_sessions (course_plan_slot_id, date, trainer_id)
  where course_plan_slot_id is not null;

-- Leitet is_substitution und course_type_id bei Plan-Slot-Sessions serverseitig ab
-- (verhindert Manipulation und erhält den Kurstyp auch nach späterer Plan-Archivierung).
create or replace function derive_course_session_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_trainer_id uuid;
  v_slot_course_type_id uuid;
begin
  if tg_op = 'INSERT' and new.logged_by is null then
    new.logged_by := auth.uid();
  end if;

  if new.course_plan_slot_id is not null then
    select sl.trainer_id, sl.course_type_id
    into v_slot_trainer_id, v_slot_course_type_id
    from course_plan_slots sl
    where sl.id = new.course_plan_slot_id;

    if v_slot_trainer_id is not null then
      new.is_substitution := (new.trainer_id <> v_slot_trainer_id);
      if new.course_type_id is null then
        new.course_type_id := v_slot_course_type_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function derive_course_session_fields() from public, anon, authenticated;

drop trigger if exists course_sessions_derive_fields on course_sessions;
create trigger course_sessions_derive_fields
  before insert or update of course_plan_slot_id, trainer_id, course_type_id on course_sessions
  for each row execute function derive_course_session_fields();

-- Liefert alle Studios, bei deren Company die eingeloggte Trainer:in einen aktiven Vertrag hat.
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
  where has_active_contract(auth.uid(), c.id)
  order by c.name asc, s.name asc;
$$;

-- Liefert alle aktiven Kursplan-Slots der Studios, bei denen die eingeloggte Trainer:in
-- einen aktiven Vertrag hat (eigene Slots + fremde Slots für spontane Vertretungen).
-- Datenschutz: gibt von Kolleg:innen nur den Anzeigenamen (nie E-Mail/Telefon/Adresse) zurück.
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
  where has_active_contract(auth.uid(), c.id)
  order by sl.weekday asc, sl.start_time asc, s.name asc;
$$;

-- Eigene erfasste course_sessions der eingeloggten Trainer:in (inkl. Studio-/Kurstyp-/Vertretungs-Info).
create or replace function get_my_course_sessions(
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  studio_id uuid,
  studio_name text,
  company_id uuid,
  company_name text,
  course_plan_slot_id uuid,
  course_type_id uuid,
  course_type_name text,
  date date,
  start_time time,
  end_time time,
  trainer_id uuid,
  is_substitution boolean,
  scheduled_trainer_name text,
  status text,
  notes text,
  logged_at timestamptz,
  locked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cs.id,
    cs.studio_id,
    s.name as studio_name,
    c.id as company_id,
    c.name as company_name,
    cs.course_plan_slot_id,
    coalesce(cs.course_type_id, sl.course_type_id) as course_type_id,
    ct.name as course_type_name,
    cs.date,
    cs.start_time,
    cs.end_time,
    cs.trainer_id,
    cs.is_substitution,
    case
      when sl.trainer_id is not null and sl.trainer_id <> cs.trainer_id then
        coalesce(nullif(trim(sp.full_name), ''), split_part(su.email::text, '@', 1))
      else null
    end as scheduled_trainer_name,
    cs.status,
    cs.notes,
    cs.logged_at,
    cs.locked_at
  from course_sessions cs
  join studios s on s.id = cs.studio_id
  join companies c on c.id = s.company_id
  left join course_plan_slots sl on sl.id = cs.course_plan_slot_id
  left join course_types ct on ct.id = coalesce(cs.course_type_id, sl.course_type_id)
  left join auth.users su on su.id = sl.trainer_id
  left join profiles sp on sp.id = sl.trainer_id
  where cs.trainer_id = auth.uid()
    and (p_from is null or cs.date >= p_from)
    and (p_to is null or cs.date <= p_to)
  order by cs.date desc, cs.start_time desc, cs.logged_at desc;
$$;

revoke all on function
  get_trainer_studios(),
  get_trainer_studio_slots(),
  get_my_course_sessions(date, date)
from public, anon;

grant execute on function
  get_trainer_studios(),
  get_trainer_studio_slots(),
  get_my_course_sessions(date, date)
to authenticated;

notify pgrst, 'reload schema';
