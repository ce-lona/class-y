-- DSGVO-Flows: Konto-Löschung durch Admins, Datenauskunft (Export) und Company-Offboarding.
--
-- 1. Konto-Löschung (Art. 17): company_admin/platform_admin löschen Konten. Trainer:innen
--    löschen sich nicht selbst. Bestehen abrechnungsrelevante Datensätze (Contracts, erfasste
--    Kurse, Plan-Slots, Vertretungen), bleiben diese wegen gesetzlicher Aufbewahrungspflichten
--    (Art. 17 Abs. 3 lit. b, §147 AO/§257 HGB) erhalten; das Profil wird anonymisiert und das
--    Login (auth.users) gelöscht. Ohne solche Datensätze wird auch das Profil hart gelöscht.
-- 2. Datenauskunft (Art. 15/20): export_user_data / export_company_data liefern JSON; die App
--    wandelt das bei Bedarf in CSV um.
-- 3. Offboarding: platform_admin plant die Löschung einer Company nach Kündigung mit 30 Tagen
--    Karenz; danach löscht purge_due_company_deletions() alle Daten der Company hart, inkl.
--    Konten, die an keine andere Company/Rolle mehr gebunden sind.
-- 4. gdpr_audit_log: Löschprotokoll (nur IDs, keine personenbezogenen Inhalte).

-- ─────────────────────────────────────────────────────────────────
-- SCHEMA
-- ─────────────────────────────────────────────────────────────────

-- Anonymisierte Profile überleben das gelöschte Login, daher kein FK/Kaskade mehr auf
-- auth.users. Ein Löschen in auth.users (auch über das Supabase-Dashboard) räumt das Profil
-- per Trigger auf (siehe on_auth_user_deleted).
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles add column deleted_at timestamptz;

alter table companies add column deletion_requested_at timestamptz;
alter table companies add column deletion_scheduled_for timestamptz;
alter table companies add column deletion_requested_by uuid references profiles(id) on delete set null;

create table gdpr_audit_log (
  id         bigint generated always as identity primary key,
  action     text not null check (action in (
               'user_deleted', 'user_exported', 'company_exported',
               'company_deletion_scheduled', 'company_deletion_cancelled', 'company_purged')),
  subject_id uuid not null,
  -- bewusst ohne FK: Protokoll bleibt bestehen, auch wenn der/die Ausführende gelöscht wird
  actor_id   uuid,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index gdpr_audit_log_subject_idx on gdpr_audit_log (subject_id);

alter table gdpr_audit_log enable row level security;

create policy "gdpr_audit_log: platform_admin liest"
  on gdpr_audit_log for select
  using (is_platform_admin());

-- Schreiben ausschließlich über die security-definer-Funktionen unten.
revoke insert, update, delete on gdpr_audit_log from authenticated, anon;

-- ─────────────────────────────────────────────────────────────────
-- SCHUTZ: Lösch-/Offboarding-Felder nur über RPCs änderbar
-- (Endnutzer:innen dürfen companies bzw. das eigene Profil sonst direkt updaten)
-- ─────────────────────────────────────────────────────────────────
create or replace function guard_gdpr_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_table_name = 'companies' then
    if tg_op = 'INSERT' then
      if new.deletion_requested_at is not null
         or new.deletion_scheduled_for is not null
         or new.deletion_requested_by is not null then
        raise exception 'company_deletion_fields_readonly';
      end if;
    elsif new.deletion_requested_at is distinct from old.deletion_requested_at
       or new.deletion_scheduled_for is distinct from old.deletion_scheduled_for
       or new.deletion_requested_by is distinct from old.deletion_requested_by then
      raise exception 'company_deletion_fields_readonly';
    end if;
  elsif tg_table_name = 'profiles' then
    if tg_op = 'INSERT' then
      if new.deleted_at is not null then
        raise exception 'profile_deleted_at_readonly';
      end if;
    elsif new.deleted_at is distinct from old.deleted_at then
      raise exception 'profile_deleted_at_readonly';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function guard_gdpr_columns() from public, anon, authenticated;

create trigger companies_guard_gdpr_columns
  before insert or update on companies
  for each row execute function guard_gdpr_columns();

create trigger profiles_guard_gdpr_columns
  before insert or update on profiles
  for each row execute function guard_gdpr_columns();

-- ─────────────────────────────────────────────────────────────────
-- INTERNE HILFSFUNKTIONEN (nicht für authenticated ausführbar)
-- ─────────────────────────────────────────────────────────────────

-- Alle Companies, an die eine Person gebunden ist (Rolle oder Datensätze).
create or replace function gdpr_user_company_ids(p_user_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select company_id from company_admins where user_id = p_user_id
  union
  select s.company_id from studio_coordinators sc
    join studios s on s.id = sc.studio_id
    where sc.user_id = p_user_id
  union
  select company_id from contracts where trainer_id = p_user_id
  union
  select s.company_id from course_sessions cs
    join studios s on s.id = cs.studio_id
    where cs.trainer_id = p_user_id
  union
  select s.company_id from course_plan_slots sl
    join course_plans cp on cp.id = sl.course_plan_id
    join studios s on s.id = cp.studio_id
    where sl.trainer_id = p_user_id
  union
  select s.company_id from substitute_assignments sa
    join course_plan_slots sl on sl.id = sa.course_plan_slot_id
    join course_plans cp on cp.id = sl.course_plan_id
    join studios s on s.id = cp.studio_id
    where p_user_id in (sa.original_trainer_id, sa.substitute_trainer_id);
$$;

-- Datensätze, die wegen Aufbewahrungspflichten das Profil (anonymisiert) erhalten.
create or replace function gdpr_user_has_retained_records(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from contracts where trainer_id = p_user_id)
      or exists (select 1 from course_sessions where trainer_id = p_user_id)
      or exists (select 1 from course_plan_slots where trainer_id = p_user_id)
      or exists (
        select 1 from substitute_assignments
        where p_user_id in (original_trainer_id, substitute_trainer_id)
      );
$$;

-- Räumt alle personenbezogenen Daten in public auf. Wird vom auth.users-Delete-Trigger
-- aufgerufen (und direkt, falls kein Login mehr existiert).
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

create or replace function handle_deleted_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform gdpr_scrub_profile(old.id);
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute procedure handle_deleted_user();

create or replace function gdpr_log(p_action text, p_subject uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into gdpr_audit_log (action, subject_id, actor_id, details)
  values (p_action, p_subject, auth.uid(), coalesce(p_details, '{}'::jsonb));
$$;

-- Hart löschen: alle Daten der Company + Konten ohne verbleibende Bindung.
create or replace function gdpr_purge_company(p_company_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_users uuid[];
  v_user uuid;
  v_deleted integer := 0;
begin
  select coalesce(array_agg(distinct u), '{}') into v_users from (
    select user_id from company_admins where company_id = p_company_id
    union
    select sc.user_id from studio_coordinators sc
      join studios s on s.id = sc.studio_id where s.company_id = p_company_id
    union
    select trainer_id from contracts where company_id = p_company_id
    union
    select cs.trainer_id from course_sessions cs
      join studios s on s.id = cs.studio_id where s.company_id = p_company_id
    union
    select sl.trainer_id from course_plan_slots sl
      join course_plans cp on cp.id = sl.course_plan_id
      join studios s on s.id = cp.studio_id where s.company_id = p_company_id
    union
    select unnest(array[sa.original_trainer_id, sa.substitute_trainer_id])
    from substitute_assignments sa
      join course_plan_slots sl on sl.id = sa.course_plan_slot_id
      join course_plans cp on cp.id = sl.course_plan_id
      join studios s on s.id = cp.studio_id where s.company_id = p_company_id
  ) x(u);

  -- Reihenfolge wegen ON DELETE RESTRICT (Slots → Kurstypen, Sessions/Slots → Profile).
  delete from course_sessions
  where studio_id in (select id from studios where company_id = p_company_id);
  delete from course_plans  -- kaskadiert Slots und Vertretungen
  where studio_id in (select id from studios where company_id = p_company_id);
  delete from contracts where company_id = p_company_id;
  delete from companies where id = p_company_id;  -- kaskadiert Studios, Kurstypen, Admins, Koordinatoren

  foreach v_user in array v_users loop
    if not exists (select 1 from gdpr_user_company_ids(v_user))
       and not exists (select 1 from platform_admins where user_id = v_user)
       and not gdpr_user_has_retained_records(v_user) then
      delete from auth.users where id = v_user;  -- Trigger löscht das Profil
      if not found then
        perform gdpr_scrub_profile(v_user);
      end if;
      v_deleted := v_deleted + 1;
    end if;
  end loop;

  return v_deleted;
end;
$$;

revoke all on function
  gdpr_user_company_ids(uuid),
  gdpr_user_has_retained_records(uuid),
  gdpr_scrub_profile(uuid),
  handle_deleted_user(),
  gdpr_log(text, uuid, jsonb),
  gdpr_purge_company(uuid)
from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- RPC: PERSONEN EINER COMPANY (Datenschutz-Übersicht)
-- ─────────────────────────────────────────────────────────────────
-- Alle nicht gelöschten Konten mit Bezug zur Company, inkl. Grund, warum die aufrufende
-- Person sie (noch) nicht löschen kann: self | other_company | active_plan | NULL.
create or replace function get_company_people(target_company_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  roles text[],
  delete_blocked_reason text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
  with people as (
    select c.trainer_id as id from contracts c
      where c.company_id = target_company_id and c.status in ('pending', 'active', 'ended')
    union select cs.trainer_id from course_sessions cs
      join studios s on s.id = cs.studio_id where s.company_id = target_company_id
    union select ca.user_id from company_admins ca where ca.company_id = target_company_id
    union select sc.user_id from studio_coordinators sc
      join studios s on s.id = sc.studio_id where s.company_id = target_company_id
  )
  select
    p.id,
    u.email::text,
    p.full_name,
    array_remove(array[
      case when exists (select 1 from company_admins ca
                        where ca.user_id = p.id and ca.company_id = target_company_id)
           then 'company_admin' end,
      case when exists (select 1 from studio_coordinators sc join studios s on s.id = sc.studio_id
                        where sc.user_id = p.id and s.company_id = target_company_id)
           then 'coordinator' end,
      case when exists (select 1 from contracts c
                        where c.trainer_id = p.id and c.company_id = target_company_id)
             or exists (select 1 from course_sessions cs join studios s on s.id = cs.studio_id
                        where cs.trainer_id = p.id and s.company_id = target_company_id)
           then 'trainer' end
    ], null),
    case
      when p.id = auth.uid() then 'self'
      when not is_platform_admin() and (
        exists (select 1 from platform_admins pa where pa.user_id = p.id)
        or exists (select 1 from gdpr_user_company_ids(p.id) c where not is_company_admin(c))
      ) then 'other_company'
      when exists (
        select 1 from course_plan_slots sl
        join course_plans cp on cp.id = sl.course_plan_id
        where sl.trainer_id = p.id and cp.status = 'active'
          and (cp.valid_to is null or cp.valid_to >= current_date)
      ) then 'active_plan'
    end
  from people x
  join profiles p on p.id = x.id and p.deleted_at is null
  left join auth.users u on u.id = p.id
  order by coalesce(p.full_name, u.email::text);
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RPC: KONTO LÖSCHEN
-- ─────────────────────────────────────────────────────────────────
-- platform_admin: jedes Konto außer dem eigenen.
-- company_admin: nur Konten, die ausschließlich an eigene Companies gebunden sind
-- (keine Contracts/Rollen/Kurse bei anderen Companies, kein platform_admin).
-- Trainer:innen in einem aktiven Kursplan müssen vorher ausgeplant werden.
create or replace function admin_delete_user(target_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_companies uuid[];
  v_result text;
begin
  if auth.uid() is null or not (
    is_platform_admin() or exists (select 1 from company_admins where user_id = auth.uid())
  ) then
    raise exception 'not_authorized';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'cannot_delete_self';
  end if;

  if not exists (select 1 from profiles where id = target_user_id and deleted_at is null)
     and not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'user_not_found';
  end if;

  select coalesce(array_agg(c), '{}') into v_companies from gdpr_user_company_ids(target_user_id) c;

  if not is_platform_admin() then
    if not exists (select 1 from unnest(v_companies) c where is_company_admin(c)) then
      raise exception 'not_authorized';
    end if;
    if exists (select 1 from platform_admins where user_id = target_user_id)
       or exists (select 1 from unnest(v_companies) c where not is_company_admin(c)) then
      raise exception 'user_belongs_to_other_company';
    end if;
  end if;

  if exists (
    select 1 from course_plan_slots sl
    join course_plans cp on cp.id = sl.course_plan_id
    where sl.trainer_id = target_user_id
      and cp.status = 'active'
      and (cp.valid_to is null or cp.valid_to >= current_date)
  ) then
    raise exception 'user_in_active_course_plan';
  end if;

  delete from auth.users where id = target_user_id;  -- Trigger räumt das Profil auf
  if not found then
    perform gdpr_scrub_profile(target_user_id);
  end if;

  v_result := case
    when exists (select 1 from profiles where id = target_user_id) then 'anonymized'
    else 'deleted'
  end;

  perform gdpr_log('user_deleted', target_user_id,
    jsonb_build_object('result', v_result, 'company_ids', to_jsonb(v_companies)));

  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RPC: DATENAUSKUNFT PERSON
-- ─────────────────────────────────────────────────────────────────
-- platform_admin: alle Daten der Person. company_admin: nur Daten, die zu den eigenen
-- Companies gehören (die Person muss an mindestens eine davon gebunden sein).
create or replace function export_user_data(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_all boolean := is_platform_admin();
  v_scope uuid[];
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  if not exists (select 1 from profiles where id = target_user_id) then
    raise exception 'user_not_found';
  end if;

  if not v_all then
    select array_agg(c) into v_scope
    from gdpr_user_company_ids(target_user_id) c
    where is_company_admin(c);

    if v_scope is null then
      raise exception 'not_authorized';
    end if;
  end if;

  select jsonb_build_object(
    'meta', jsonb_build_object(
      'type', 'user',
      'exported_at', now(),
      'exported_by', auth.uid(),
      'scope', case when v_all then 'all' else 'company' end,
      'company_ids', to_jsonb(v_scope)
    ),
    'account', (
      select jsonb_build_object(
        'id', p.id,
        'email', u.email,
        'account_created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'deleted_at', p.deleted_at
      )
      from profiles p left join auth.users u on u.id = p.id
      where p.id = target_user_id
    ),
    'profile', (select to_jsonb(p) from profiles p where p.id = target_user_id),
    'company_admin_memberships', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'company_id', ca.company_id, 'company_name', co.name, 'created_at', ca.created_at
      ) order by ca.created_at), '[]'::jsonb)
      from company_admins ca join companies co on co.id = ca.company_id
      where ca.user_id = target_user_id
        and (v_all or ca.company_id = any(v_scope))
    ),
    'coordinator_memberships', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'company_id', s.company_id, 'studio_id', s.id, 'studio_name', s.name, 'created_at', sc.created_at
      ) order by sc.created_at), '[]'::jsonb)
      from studio_coordinators sc join studios s on s.id = sc.studio_id
      where sc.user_id = target_user_id
        and (v_all or s.company_id = any(v_scope))
    ),
    'contracts', (
      select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
        'company_name', co.name,
        'studio_ids', (select coalesce(jsonb_agg(cs.studio_id), '[]'::jsonb)
                       from contract_studios cs where cs.contract_id = c.id)
      ) order by c.valid_from), '[]'::jsonb)
      from contracts c join companies co on co.id = c.company_id
      where c.trainer_id = target_user_id
        and (v_all or c.company_id = any(v_scope))
    ),
    'course_plan_slots', (
      select coalesce(jsonb_agg(to_jsonb(sl) || jsonb_build_object(
        'studio_id', s.id, 'studio_name', s.name, 'company_id', s.company_id,
        'plan_status', cp.status, 'plan_valid_from', cp.valid_from, 'plan_valid_to', cp.valid_to,
        'course_type_name', ct.name
      ) order by cp.valid_from, sl.weekday, sl.start_time), '[]'::jsonb)
      from course_plan_slots sl
      join course_plans cp on cp.id = sl.course_plan_id
      join studios s on s.id = cp.studio_id
      left join course_types ct on ct.id = sl.course_type_id
      where sl.trainer_id = target_user_id
        and (v_all or s.company_id = any(v_scope))
    ),
    'course_sessions', (
      select coalesce(jsonb_agg(to_jsonb(cs) || jsonb_build_object(
        'studio_name', s.name, 'company_id', s.company_id, 'course_type_name', ct.name
      ) order by cs.date, cs.start_time), '[]'::jsonb)
      from course_sessions cs
      join studios s on s.id = cs.studio_id
      left join course_types ct on ct.id = cs.course_type_id
      where cs.trainer_id = target_user_id
        and (v_all or s.company_id = any(v_scope))
    ),
    'substitute_assignments', (
      select coalesce(jsonb_agg(to_jsonb(sa) || jsonb_build_object(
        'studio_id', s.id, 'studio_name', s.name, 'company_id', s.company_id
      ) order by sa.date), '[]'::jsonb)
      from substitute_assignments sa
      join course_plan_slots sl on sl.id = sa.course_plan_slot_id
      join course_plans cp on cp.id = sl.course_plan_id
      join studios s on s.id = cp.studio_id
      where target_user_id in (sa.original_trainer_id, sa.substitute_trainer_id)
        and (v_all or s.company_id = any(v_scope))
    )
  ) into v_result;

  perform gdpr_log('user_exported', target_user_id,
    jsonb_build_object('scope', case when v_all then 'all' else 'company' end,
                       'company_ids', to_jsonb(v_scope)));

  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RPC: DATENEXPORT COMPANY
-- ─────────────────────────────────────────────────────────────────
create or replace function export_company_data(target_company_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  if not exists (select 1 from companies where id = target_company_id) then
    raise exception 'company_not_found';
  end if;

  with
  studio_ids as (select id from studios where company_id = target_company_id),
  plan_ids as (select id from course_plans where studio_id in (select id from studio_ids)),
  slot_ids as (select id from course_plan_slots where course_plan_id in (select id from plan_ids)),
  people as (
    select trainer_id as id from contracts where company_id = target_company_id
    union select trainer_id from course_sessions where studio_id in (select id from studio_ids)
    union select trainer_id from course_plan_slots where id in (select id from slot_ids)
    union select user_id from company_admins where company_id = target_company_id
    union select user_id from studio_coordinators where studio_id in (select id from studio_ids)
  )
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'type', 'company',
      'exported_at', now(),
      'exported_by', auth.uid()
    ),
    'company', (select to_jsonb(c) from companies c where c.id = target_company_id),
    'studios', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.name), '[]'::jsonb)
      from studios s where s.company_id = target_company_id
    ),
    'people', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'email', u.email,
        'full_name', p.full_name,
        'phone', p.phone,
        'street', p.street,
        'house_number', p.house_number,
        'postal_code', p.postal_code,
        'city', p.city,
        'country', p.country,
        'kleinunternehmer', p.kleinunternehmer,
        'deleted_at', p.deleted_at
      ) order by p.full_name), '[]'::jsonb)
      from people x join profiles p on p.id = x.id
      left join auth.users u on u.id = p.id
    ),
    'company_admins', (
      select coalesce(jsonb_agg(to_jsonb(ca) order by ca.created_at), '[]'::jsonb)
      from company_admins ca where ca.company_id = target_company_id
    ),
    'studio_coordinators', (
      select coalesce(jsonb_agg(to_jsonb(sc) order by sc.created_at), '[]'::jsonb)
      from studio_coordinators sc where sc.studio_id in (select id from studio_ids)
    ),
    'course_types', (
      select coalesce(jsonb_agg(to_jsonb(ct) order by ct.name), '[]'::jsonb)
      from course_types ct where ct.company_id = target_company_id
    ),
    'course_type_studios', (
      select coalesce(jsonb_agg(to_jsonb(cts)), '[]'::jsonb)
      from course_type_studios cts where cts.studio_id in (select id from studio_ids)
    ),
    'contracts', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.valid_from), '[]'::jsonb)
      from contracts c where c.company_id = target_company_id
    ),
    'contract_studios', (
      select coalesce(jsonb_agg(to_jsonb(cs)), '[]'::jsonb)
      from contract_studios cs where cs.studio_id in (select id from studio_ids)
    ),
    'course_plans', (
      select coalesce(jsonb_agg(to_jsonb(cp) order by cp.valid_from), '[]'::jsonb)
      from course_plans cp where cp.id in (select id from plan_ids)
    ),
    'course_plan_slots', (
      select coalesce(jsonb_agg(to_jsonb(sl) order by sl.weekday, sl.start_time), '[]'::jsonb)
      from course_plan_slots sl where sl.id in (select id from slot_ids)
    ),
    'course_sessions', (
      select coalesce(jsonb_agg(to_jsonb(cs) order by cs.date, cs.start_time), '[]'::jsonb)
      from course_sessions cs where cs.studio_id in (select id from studio_ids)
    ),
    'substitute_assignments', (
      select coalesce(jsonb_agg(to_jsonb(sa) order by sa.date), '[]'::jsonb)
      from substitute_assignments sa where sa.course_plan_slot_id in (select id from slot_ids)
    )
  ) into v_result;

  perform gdpr_log('company_exported', target_company_id);

  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RPCs: COMPANY-OFFBOARDING (nur platform_admin)
-- ─────────────────────────────────────────────────────────────────
create or replace function schedule_company_deletion(target_company_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_scheduled timestamptz;
begin
  if auth.uid() is null or not is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  if not exists (select 1 from companies where id = target_company_id) then
    raise exception 'company_not_found';
  end if;

  if exists (
    select 1 from companies
    where id = target_company_id and deletion_scheduled_for is not null
  ) then
    raise exception 'company_deletion_already_scheduled';
  end if;

  update companies
  set deletion_requested_at = now(),
      deletion_scheduled_for = now() + interval '30 days',
      deletion_requested_by = auth.uid()
  where id = target_company_id
  returning deletion_scheduled_for into v_scheduled;

  perform gdpr_log('company_deletion_scheduled', target_company_id,
    jsonb_build_object('scheduled_for', v_scheduled));

  return v_scheduled;
end;
$$;

create or replace function cancel_company_deletion(target_company_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  update companies
  set deletion_requested_at = null,
      deletion_scheduled_for = null,
      deletion_requested_by = null
  where id = target_company_id and deletion_scheduled_for is not null;

  if not found then
    raise exception 'company_deletion_not_scheduled';
  end if;

  perform gdpr_log('company_deletion_cancelled', target_company_id);
end;
$$;

-- Löscht alle Companies, deren Karenzzeit abgelaufen ist. Läuft täglich per pg_cron
-- (falls verfügbar) und kann von platform_admins manuell ausgelöst werden.
create or replace function purge_due_company_deletions()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_company record;
  v_users integer;
  v_count integer := 0;
begin
  -- security definer: current_user ist hier der Owner, daher session_user/Claims prüfen.
  if auth.uid() is not null then
    if not is_platform_admin() then
      raise exception 'not_authorized';
    end if;
  elsif coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'not_authorized';
  end if;

  for v_company in
    select id, deletion_scheduled_for from companies
    where deletion_scheduled_for is not null and deletion_scheduled_for <= now()
    order by deletion_scheduled_for
  loop
    v_users := gdpr_purge_company(v_company.id);
    perform gdpr_log('company_purged', v_company.id, jsonb_build_object(
      'scheduled_for', v_company.deletion_scheduled_for,
      'users_deleted', v_users
    ));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function
  get_company_people(uuid),
  admin_delete_user(uuid),
  export_user_data(uuid),
  export_company_data(uuid),
  schedule_company_deletion(uuid),
  cancel_company_deletion(uuid),
  purge_due_company_deletions()
from public, anon;

grant execute on function
  get_company_people(uuid),
  admin_delete_user(uuid),
  export_user_data(uuid),
  export_company_data(uuid),
  schedule_company_deletion(uuid),
  cancel_company_deletion(uuid),
  purge_due_company_deletions()
to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- Täglicher Purge-Job (03:17 UTC), sofern pg_cron verfügbar ist.
-- ─────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'gdpr-purge-due-companies',
      '17 3 * * *',
      'select public.purge_due_company_deletions()'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
