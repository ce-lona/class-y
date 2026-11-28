-- Team-Übersicht im Admin-Bereich: Company-Admins, Studio-Admins (studio_coordinators) und
-- Trainer:innen (letzter Vertrag je Person) in einer Liste, mit Zeitpunkt der letzten Änderung.
-- Nur Company-Admins und Plattform-Admins; Studio-Admins nutzen weiter die Vertragsliste.

create or replace function get_company_team(target_company_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  studio_ids uuid[],
  contract_status text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select
      ca.user_id,
      u.email::text,
      p.full_name,
      'company_admin'::text,
      null::uuid[],
      null::text,
      greatest(ca.created_at, p.master_data_updated_at)
    from company_admins ca
    join auth.users u on u.id = ca.user_id
    left join profiles p on p.id = ca.user_id
    where ca.company_id = target_company_id

    union all

    select
      sc.user_id,
      u.email::text,
      p.full_name,
      'coordinator'::text,
      array_agg(sc.studio_id order by sc.studio_id),
      null::text,
      greatest(max(sc.created_at), max(p.master_data_updated_at))
    from studio_coordinators sc
    join studios s on s.id = sc.studio_id and s.company_id = target_company_id
    join auth.users u on u.id = sc.user_id
    left join profiles p on p.id = sc.user_id
    group by sc.user_id, u.email, p.full_name

    union all

    select
      lc.trainer_id,
      u.email::text,
      p.full_name,
      'trainer'::text,
      (select array_agg(cs.studio_id order by cs.studio_id)
         from contract_studios cs where cs.contract_id = lc.id),
      lc.status,
      greatest(lc.created_at, lc.accepted_at, lc.confirmed_at, p.master_data_updated_at)
    from (
      select distinct on (c.trainer_id) c.*
      from contracts c
      where c.company_id = target_company_id
      order by c.trainer_id, c.created_at desc
    ) lc
    join auth.users u on u.id = lc.trainer_id
    left join profiles p on p.id = lc.trainer_id;
end;
$$;

revoke execute on function get_company_team(uuid) from public, anon;
grant execute on function get_company_team(uuid) to authenticated;

-- Company-Admins dürfen weitere Admins ihrer eigenen Company hinzufügen (bisher nur Plattform).
create or replace function add_company_admin(target_company_id uuid, target_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(target_email);
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into company_admins (user_id, company_id)
  values (v_user_id, target_company_id)
  on conflict (user_id, company_id) do nothing;
end;
$$;

-- Name beim Anlegen einer Person: setzt den Namen im Profil, solange die Person selbst noch
-- keinen eingetragen hat. Nur für Personen, die zur Company gehören (Admin, Studio-Admin oder
-- Vertrag), und nur durch Company-Admins dieser Company oder Plattform-Admins.
create or replace function set_team_member_name(
  target_company_id uuid,
  target_email text,
  p_full_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_name text := nullif(trim(p_full_name), '');
  v_updated int;
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;
  if v_name is null then
    return false;
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(target_email);
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  if not (
    exists (select 1 from company_admins where user_id = v_user_id and company_id = target_company_id)
    or exists (
      select 1 from studio_coordinators sc join studios s on s.id = sc.studio_id
      where sc.user_id = v_user_id and s.company_id = target_company_id
    )
    or exists (select 1 from contracts where trainer_id = v_user_id and company_id = target_company_id)
  ) then
    raise exception 'not_a_member';
  end if;

  update profiles set full_name = left(v_name, 200)
  where id = v_user_id and (full_name is null or trim(full_name) = '');
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function set_team_member_name(uuid, text, text) from public, anon;
grant execute on function set_team_member_name(uuid, text, text) to authenticated;
