-- Vertragsliste einer Company für company_admin/platform_admin.
-- Admins sehen das Profil einer Person erst nach Annahme; hier wird daher die
-- E-Mail-Adresse (die der Admin selbst angegeben hat) immer, der Name nur bei
-- angenommenen oder beendeten Verträgen zurückgegeben.

create function get_company_contracts(target_company_id uuid)
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
  accepted_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select c.id, u.email::text,
           case when c.accepted_at is not null then p.full_name end,
           c.employment_type, c.rate_model, c.rate_amount,
           c.valid_from, c.valid_to, c.status, c.accepted_at
    from contracts c
    join auth.users u on u.id = c.trainer_id
    left join profiles p on p.id = c.trainer_id
    where c.company_id = target_company_id
    order by c.created_at desc;
end;
$$;

revoke all on function get_company_contracts(uuid) from public, anon;
grant execute on function get_company_contracts(uuid) to authenticated, service_role;
