-- Phase 1.5: Geplante & angefragte Vertretungen (`substitute_assignments`).
-- Jede Vertretung startet zwingend im Status `pending` und wird erst durch
-- ausdrückliche Annahme der angefragten Vertretung (`accepted`) wirksam.

create table substitute_assignments (
  id                    uuid primary key default gen_random_uuid(),
  course_plan_slot_id   uuid not null references course_plan_slots(id) on delete cascade,
  date                  date not null,
  original_trainer_id   uuid not null references profiles(id) on delete restrict,
  substitute_trainer_id uuid not null references profiles(id) on delete restrict,
  status                text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  notes                 text,
  requested_by          uuid references profiles(id) on delete set null,
  responded_at          timestamptz,
  created_at            timestamptz not null default now(),

  constraint substitute_assignments_different_trainers check (original_trainer_id <> substitute_trainer_id)
);

-- Pro Plan-Slot und Datum darf es höchstens eine offene (pending) oder angenommene (accepted) Vertretung geben.
create unique index substitute_assignments_active_slot_date
  on substitute_assignments (course_plan_slot_id, date)
  where status in ('pending', 'accepted');

create index substitute_assignments_original_idx on substitute_assignments (original_trainer_id, date);
create index substitute_assignments_substitute_idx on substitute_assignments (substitute_trainer_id, date);

alter table substitute_assignments enable row level security;

create policy "substitute_assignments: beteiligte und admins lesen"
  on substitute_assignments for select
  using (
    original_trainer_id = auth.uid()
    or substitute_trainer_id = auth.uid()
    or is_platform_admin()
    or is_company_admin((
      select s.company_id
      from course_plan_slots sl
      join course_plans cp on cp.id = sl.course_plan_id
      join studios s on s.id = cp.studio_id
      where sl.id = substitute_assignments.course_plan_slot_id
    ))
  );

-- Datenschutzfreundliche Kolleg:innen-Liste innerhalb einer Company (nur ID + Anzeigename, keine E-Mail/Telefon/Adresse).
create or replace function get_company_colleagues(target_company_id uuid)
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
    or has_active_contract(auth.uid(), target_company_id)
  ) then
    raise exception 'not_authorized';
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
      and (c.valid_to is null or c.valid_to >= current_date)
    order by c.trainer_id, c.valid_from desc;
end;
$$;

-- Vertretung anfragen (durch eingeteilte Trainer:in oder Company-/Platform-Admin).
-- Startet IMMER mit status = 'pending'.
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
  v_original_trainer_id uuid;
  v_assignment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  select s.company_id, sl.trainer_id
  into v_company_id, v_original_trainer_id
  from course_plan_slots sl
  join course_plans cp on cp.id = sl.course_plan_id
  join studios s on s.id = cp.studio_id
  where sl.id = p_slot_id;

  if v_company_id is null then
    raise exception 'slot_not_found';
  end if;

  if not (
    auth.uid() = v_original_trainer_id
    or is_company_admin(v_company_id)
    or is_platform_admin()
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

-- Angefragte Vertretung annehmen oder ablehnen (ausschließlich durch die angefragte Person).
create or replace function respond_substitution(
  p_assignment_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  if p_decision not in ('accepted', 'declined') then
    raise exception 'invalid_decision';
  end if;

  update substitute_assignments
  set status = p_decision,
      responded_at = now()
  where id = p_assignment_id
    and substitute_trainer_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'substitution_not_found_or_not_pending';
  end if;
end;
$$;

-- Offene (pending) Vertretungsanfrage zurückziehen.
create or replace function cancel_substitution_request(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_original_trainer_id uuid;
  v_requested_by uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  select s.company_id, sa.original_trainer_id, sa.requested_by
  into v_company_id, v_original_trainer_id, v_requested_by
  from substitute_assignments sa
  join course_plan_slots sl on sl.id = sa.course_plan_slot_id
  join course_plans cp on cp.id = sl.course_plan_id
  join studios s on s.id = cp.studio_id
  where sa.id = p_assignment_id
    and sa.status = 'pending';

  if v_company_id is null then
    raise exception 'substitution_not_found_or_not_pending';
  end if;

  if not (
    auth.uid() = v_original_trainer_id
    or auth.uid() = v_requested_by
    or is_company_admin(v_company_id)
    or is_platform_admin()
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

-- Eigene ein- und ausgehende Vertretungen der eingeloggten Trainer:in.
create or replace function get_my_substitutions(
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  course_plan_slot_id uuid,
  date date,
  studio_id uuid,
  studio_name text,
  company_id uuid,
  company_name text,
  weekday smallint,
  start_time time,
  end_time time,
  course_type_id uuid,
  course_type_name text,
  original_trainer_id uuid,
  original_trainer_name text,
  substitute_trainer_id uuid,
  substitute_trainer_name text,
  status text,
  notes text,
  direction text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sa.id,
    sa.course_plan_slot_id,
    sa.date,
    s.id as studio_id,
    s.name as studio_name,
    c.id as company_id,
    c.name as company_name,
    sl.weekday,
    sl.start_time,
    sl.end_time,
    sl.course_type_id,
    ct.name as course_type_name,
    sa.original_trainer_id,
    coalesce(nullif(trim(op.full_name), ''), split_part(ou.email::text, '@', 1)) as original_trainer_name,
    sa.substitute_trainer_id,
    coalesce(nullif(trim(sp.full_name), ''), split_part(su.email::text, '@', 1)) as substitute_trainer_name,
    sa.status,
    sa.notes,
    case when sa.substitute_trainer_id = auth.uid() then 'incoming' else 'outgoing' end as direction,
    sa.created_at
  from substitute_assignments sa
  join course_plan_slots sl on sl.id = sa.course_plan_slot_id
  join course_plans cp on cp.id = sl.course_plan_id
  join studios s on s.id = cp.studio_id
  join companies c on c.id = s.company_id
  join course_types ct on ct.id = sl.course_type_id
  join auth.users ou on ou.id = sa.original_trainer_id
  left join profiles op on op.id = sa.original_trainer_id
  join auth.users su on su.id = sa.substitute_trainer_id
  left join profiles sp on sp.id = sa.substitute_trainer_id
  where (sa.original_trainer_id = auth.uid() or sa.substitute_trainer_id = auth.uid())
    and (p_from is null or sa.date >= p_from)
    and (p_to is null or sa.date <= p_to)
  order by sa.date asc, sl.start_time asc, sa.created_at desc;
$$;

-- Monitoring um angenommene & ausstehende Vertretungen erweitern.
drop function if exists get_company_monitoring(uuid, date, date, uuid);

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
begin
  if not (is_company_admin(target_company_id) or is_platform_admin()) then
    raise exception 'not_authorized';
  end if;

  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'invalid_date_range';
  end if;

  return query
    with logged as (
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
      join studios s on s.id = cs.studio_id
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
      where s.company_id = target_company_id
        and (p_studio_id is null or s.id = p_studio_id)
        and cs.date between p_from and p_to
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
      join studios s
        on s.company_id = target_company_id
        and (p_studio_id is null or s.id = p_studio_id)
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

revoke all on function
  get_company_colleagues(uuid),
  request_substitution(uuid, date, uuid, text),
  respond_substitution(uuid, text),
  cancel_substitution_request(uuid),
  get_my_substitutions(date, date),
  get_company_monitoring(uuid, date, date, uuid)
from public, anon;

grant execute on function
  get_company_colleagues(uuid),
  request_substitution(uuid, date, uuid, text),
  respond_substitution(uuid, text),
  cancel_substitution_request(uuid),
  get_my_substitutions(date, date),
  get_company_monitoring(uuid, date, date, uuid)
to authenticated;

notify pgrst, 'reload schema';
