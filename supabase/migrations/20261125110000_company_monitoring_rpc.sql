-- Schritt 2d: Studio-Monitoring-Dashboard (company-weit, zeitraum- und studiofilterbar).
-- Kombiniert geplante Plan-Slots (inkl. historischer archivierter Pläne) mit tatsächlich
-- erfassten course_sessions (inkl. spontaner Vertretungen und Ad-hoc-Kurse) sowie
-- Vertrags-Konditionen für die Summenansicht pro Trainer:in.

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
  rate_amount numeric
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
        ct_rate.rate_amount
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
        sl.trainer_id,
        p.full_name as trainer_name,
        u.email::text as trainer_email,
        null::text as scheduled_trainer_name,
        false as is_substitution,
        false as is_ad_hoc,
        case
          when d < current_date then 'overdue'
          else 'planned'
        end as status,
        null::text as notes,
        ct_rate.employment_type,
        ct_rate.rate_model,
        ct_rate.rate_amount
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
      join course_types ct on ct.id = sl.course_type_id
      join auth.users u on u.id = sl.trainer_id
      left join profiles p on p.id = sl.trainer_id
      left join lateral (
        select c.employment_type, c.rate_model, c.rate_amount
        from contracts c
        where c.trainer_id = sl.trainer_id
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

revoke all on function get_company_monitoring(uuid, date, date, uuid) from public, anon;
grant execute on function get_company_monitoring(uuid, date, date, uuid) to authenticated;

notify pgrst, 'reload schema';
