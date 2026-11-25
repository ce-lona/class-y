-- Monatlicher Abrechnungs-Export (CSV/PDF) pro Trainer:in und Studio.
--
-- Wer darf exportieren?
--   * Company-Admins / Platform-Admins: alle Studios der Company
--   * Kurskoordinator:innen: nur ihre zugewiesenen Studios
--   * Trainer:innen: nur ihre eigenen Kurse (Scope 'mine')
--
-- Kategorien je Zeile:
--   given        = regulär gegebener Kurs (course_sessions.status = 'completed')
--   substitution = als Vertretung gegebener Kurs (is_substitution oder fremder Plan-Slot)
--   cancelled    = ausgefallener Kurs (course_sessions.status = 'cancelled'), kein Honorar
--   not_logged   = vergangener Plan-Slot ohne Erfassung, kein Honorar (Hinweis auf Lücke)
--
-- Honorar je Zeile wird aus dem am Kurstag gültigen Vertrag berechnet
-- (per_course / hourly / per_minute). Monatspauschalen (fixed) haben kein Honorar je Kurs;
-- sie werden im Client einmal pro Trainer:in ausgewiesen.

-- ─────────────────────────────────────────────────────────────────
-- Interne Zeilen-Funktion (nicht für authenticated freigegeben).
-- Logik analog get_company_monitoring, ergänzt um Kategorie & Honorar.
-- ─────────────────────────────────────────────────────────────────
create or replace function billing_export_rows(
  target_company_id uuid,
  p_from date,
  p_to date,
  p_studio_ids uuid[],
  p_trainer_id uuid
)
returns table (
  row_key text,
  session_id uuid,
  studio_id uuid,
  studio_name text,
  course_date date,
  start_time time,
  end_time time,
  duration_min integer,
  course_type_name text,
  trainer_id uuid,
  trainer_name text,
  trainer_email text,
  trainer_kleinunternehmer boolean,
  category text,
  substituted_trainer_name text,
  is_ad_hoc boolean,
  notes text,
  employment_type text,
  rate_model text,
  rate_amount numeric,
  fee numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed_studios as (
    select s.id, s.name
    from studios s
    where s.company_id = target_company_id
      and s.id = any(p_studio_ids)
  ),
  logged as (
    select
      'session:' || cs.id::text as row_key,
      cs.id as session_id,
      cs.studio_id,
      s.name as studio_name,
      cs.date as course_date,
      cs.start_time,
      cs.end_time,
      coalesce(ct.name, 'Ad-hoc') as course_type_name,
      cs.trainer_id,
      case
        when sl.trainer_id is not null and sl.trainer_id <> cs.trainer_id then
          coalesce(nullif(trim(sp.full_name), ''), split_part(su.email::text, '@', 1))
        else null
      end as substituted_trainer_name,
      case
        when cs.status = 'cancelled' then 'cancelled'
        when cs.status = 'completed'
          and (cs.is_substitution or (sl.trainer_id is not null and sl.trainer_id <> cs.trainer_id))
          then 'substitution'
        when cs.status = 'completed' then 'given'
        else 'not_logged'
      end as category,
      (cs.course_plan_slot_id is null) as is_ad_hoc,
      cs.notes
    from course_sessions cs
    join allowed_studios s on s.id = cs.studio_id
    left join course_plan_slots sl on sl.id = cs.course_plan_slot_id
    left join course_types ct on ct.id = coalesce(cs.course_type_id, sl.course_type_id)
    left join auth.users su on su.id = sl.trainer_id
    left join profiles sp on sp.id = sl.trainer_id
    where cs.date between p_from and p_to
      and (p_trainer_id is null or cs.trainer_id = p_trainer_id)
      -- vorab erfasste, noch nicht stattgefundene Kurse gehören nicht in die Abrechnung
      and (cs.status <> 'planned' or cs.date < current_date)
  ),
  unlogged_past as (
    select
      'slot:' || sl.id::text || ':' || d::text as row_key,
      null::uuid as session_id,
      s.id as studio_id,
      s.name as studio_name,
      d as course_date,
      sl.start_time,
      sl.end_time,
      ct.name as course_type_name,
      eff.trainer_id,
      case
        when accepted_sa.id is not null then
          coalesce(nullif(trim(op.full_name), ''), split_part(ou.email::text, '@', 1))
        else null
      end as substituted_trainer_name,
      'not_logged'::text as category,
      false as is_ad_hoc,
      accepted_sa.notes
    from generate_series(p_from, least(p_to, current_date - 1), interval '1 day') as gs(day_ts)
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
    cross join lateral (
      select coalesce(accepted_sa.substitute_trainer_id, sl.trainer_id) as trainer_id
    ) eff
    join course_types ct on ct.id = sl.course_type_id
    left join auth.users ou on ou.id = sl.trainer_id
    left join profiles op on op.id = sl.trainer_id
    where (p_trainer_id is null or eff.trainer_id = p_trainer_id)
      and not exists (
        select 1
        from course_sessions cs
        where cs.course_plan_slot_id = sl.id
          and cs.date = d
      )
  ),
  combined as (
    select * from logged
    union all
    select * from unlogged_past
  )
  select
    c.row_key,
    c.session_id,
    c.studio_id,
    c.studio_name,
    c.course_date,
    c.start_time,
    c.end_time,
    greatest(0, (extract(epoch from (c.end_time - c.start_time)) / 60)::integer) as duration_min,
    c.course_type_name,
    c.trainer_id,
    coalesce(nullif(trim(p.full_name), ''), split_part(u.email::text, '@', 1)) as trainer_name,
    u.email::text as trainer_email,
    coalesce(p.kleinunternehmer, false) as trainer_kleinunternehmer,
    c.category,
    c.substituted_trainer_name,
    c.is_ad_hoc,
    c.notes,
    r.employment_type,
    r.rate_model,
    r.rate_amount,
    case
      when c.category not in ('given', 'substitution') or r.rate_model is null then null
      when r.rate_model = 'per_course' then round(r.rate_amount, 2)
      when r.rate_model = 'hourly' then
        round(r.rate_amount * extract(epoch from (c.end_time - c.start_time)) / 3600.0, 2)
      when r.rate_model = 'per_minute' then
        round(r.rate_amount * extract(epoch from (c.end_time - c.start_time)) / 60.0, 2)
      else null -- fixed: Monatspauschale, nicht je Kurs
    end as fee
  from combined c
  join auth.users u on u.id = c.trainer_id
  left join profiles p on p.id = c.trainer_id
  left join lateral (
    select ct.employment_type, ct.rate_model, ct.rate_amount
    from contracts ct
    where ct.trainer_id = c.trainer_id
      and ct.company_id = target_company_id
      and ct.status in ('active', 'ended')
      and ct.valid_from <= c.course_date
      and (ct.valid_to is null or ct.valid_to >= c.course_date)
    order by (ct.status = 'active') desc, ct.valid_from desc, ct.created_at desc
    limit 1
  ) r on true
  order by trainer_name asc, c.studio_name asc, c.course_date asc, c.start_time asc;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Öffentliche RPC mit Rollenprüfung.
--   p_month: beliebiger Tag im Abrechnungsmonat
--   p_scope: 'company' (Admin/Koordinator) oder 'mine' (eigene Kurse als Trainer:in)
-- ─────────────────────────────────────────────────────────────────
create or replace function get_billing_export(
  target_company_id uuid,
  p_month date,
  p_scope text default 'company',
  p_studio_id uuid default null,
  p_trainer_id uuid default null
)
returns table (
  row_key text,
  session_id uuid,
  studio_id uuid,
  studio_name text,
  course_date date,
  start_time time,
  end_time time,
  duration_min integer,
  course_type_name text,
  trainer_id uuid,
  trainer_name text,
  trainer_email text,
  trainer_kleinunternehmer boolean,
  category text,
  substituted_trainer_name text,
  is_ad_hoc boolean,
  notes text,
  employment_type text,
  rate_model text,
  rate_amount numeric,
  fee numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_full_admin boolean;
  v_from date;
  v_to date;
  v_studio_ids uuid[];
  v_trainer_id uuid;
begin
  if v_uid is null or target_company_id is null then
    raise exception 'not_authorized';
  end if;

  if p_month is null then
    raise exception 'invalid_month';
  end if;

  v_from := date_trunc('month', p_month)::date;
  v_to := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;

  if p_scope = 'company' then
    v_is_full_admin := is_platform_admin() or is_company_admin(target_company_id);

    if not (v_is_full_admin or is_company_coordinator(target_company_id)) then
      raise exception 'not_authorized';
    end if;

    if not v_is_full_admin and p_studio_id is not null and not is_studio_coordinator(p_studio_id) then
      raise exception 'not_authorized';
    end if;

    select coalesce(array_agg(s.id), '{}')
    into v_studio_ids
    from studios s
    where s.company_id = target_company_id
      and (p_studio_id is null or s.id = p_studio_id)
      and (v_is_full_admin or is_studio_coordinator(s.id));

    v_trainer_id := p_trainer_id;
  elsif p_scope = 'mine' then
    -- Trainer:innen sehen ausschließlich eigene Kurse, egal welcher Filter übergeben wird.
    if p_trainer_id is not null and p_trainer_id <> v_uid then
      raise exception 'not_authorized';
    end if;

    if not exists (
      select 1 from contracts c
      where c.trainer_id = v_uid
        and c.company_id = target_company_id
        and c.status in ('active', 'ended')
    ) then
      raise exception 'not_authorized';
    end if;

    select coalesce(array_agg(s.id), '{}')
    into v_studio_ids
    from studios s
    where s.company_id = target_company_id
      and (p_studio_id is null or s.id = p_studio_id);

    v_trainer_id := v_uid;
  else
    raise exception 'invalid_scope';
  end if;

  return query
    select *
    from billing_export_rows(target_company_id, v_from, v_to, v_studio_ids, v_trainer_id);
end;
$$;

-- Companies, für die eine Trainer:in eigene Kurse exportieren darf
-- (auch nach Vertragsende, damit Vormonate abrechenbar bleiben).
create or replace function get_my_billing_companies()
returns table (
  company_id uuid,
  company_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.id as company_id, c.name as company_name
  from contracts ct
  join companies c on c.id = ct.company_id
  where ct.trainer_id = auth.uid()
    and ct.status in ('active', 'ended')
  order by c.name asc;
$$;

revoke all on function
  billing_export_rows(uuid, date, date, uuid[], uuid),
  get_billing_export(uuid, date, text, uuid, uuid),
  get_my_billing_companies()
from public, anon, authenticated;

grant execute on function
  get_billing_export(uuid, date, text, uuid, uuid),
  get_my_billing_companies()
to authenticated;

notify pgrst, 'reload schema';
