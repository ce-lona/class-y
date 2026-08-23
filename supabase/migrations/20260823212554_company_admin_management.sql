-- auth.users ist nicht über die Data API abfragbar, daher zwei admin-
-- gesicherte RPC-Funktionen statt direktem PostgREST-Zugriff.

create function add_company_admin(target_company_id uuid, target_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if not is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  select id into v_user_id from auth.users where email = target_email;
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into company_admins (user_id, company_id)
  values (v_user_id, target_company_id)
  on conflict (user_id, company_id) do nothing;
end;
$$;

grant execute on function add_company_admin(uuid, text) to authenticated;

create function get_company_admins(target_company_id uuid)
returns table (user_id uuid, email text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select ca.user_id, u.email::text, p.full_name
    from company_admins ca
    join auth.users u on u.id = ca.user_id
    left join profiles p on p.id = ca.user_id
    where ca.company_id = target_company_id;
end;
$$;

grant execute on function get_company_admins(uuid) to authenticated;
