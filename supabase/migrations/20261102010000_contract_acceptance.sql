-- Vertragsannahme durch Trainer:innen
--
-- Ein Contract wird von company_admin/platform_admin als 'pending' angeboten und erst
-- mit der Annahme durch die Trainer:in wirksam ('active'). Bis dahin gewährt er keine
-- Rechte: has_active_contract() prüft 'active', und die Company sieht die Stammdaten
-- der Person nicht. Die Person kann ein Angebot ablehnen ('declined').
--
-- Konditionen eines angenommenen Contracts (Beschäftigungsart, Vergütung, Beginn) lassen
-- sich nicht mehr ändern; zum Ändern wird der Contract beendet und ein neuer angeboten.

alter table contracts drop constraint contracts_status_check;
alter table contracts add constraint contracts_status_check
  check (status in ('pending', 'active', 'ended', 'declined'));
alter table contracts alter column status set default 'pending';
alter table contracts add column accepted_at timestamptz;

-- Bestehende, bereits aktive Contracts gelten als angenommen.
update contracts set accepted_at = created_at where status = 'active' and accepted_at is null;

-- ─────────────────────────────────────────────────────────────────
-- Trigger: Endnutzer:innen (authenticated/anon) dürfen die Annahme nicht umgehen.
-- Migrationen, service_role und die security-definer-Funktionen unten laufen mit
-- einer anderen Rolle und sind ausgenommen. Bewusst kein security definer, damit
-- current_user die ausführende Rolle widerspiegelt.
-- ─────────────────────────────────────────────────────────────────
create or replace function enforce_contract_acceptance()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.accepted_at is not null then
      raise exception 'contract_must_start_pending';
    end if;
    return new;
  end if;

  if new.trainer_id <> old.trainer_id or new.company_id <> old.company_id then
    raise exception 'contract_parties_immutable';
  end if;

  if new.accepted_at is distinct from old.accepted_at then
    raise exception 'contract_acceptance_immutable';
  end if;

  if new.status <> old.status
     and not (old.status in ('pending', 'active') and new.status = 'ended') then
    raise exception 'contract_status_transition_not_allowed';
  end if;

  if old.status = 'active' and (
       new.employment_type is distinct from old.employment_type
    or new.rate_model      is distinct from old.rate_model
    or new.rate_amount     is distinct from old.rate_amount
    or new.valid_from      is distinct from old.valid_from
  ) then
    raise exception 'contract_terms_locked_after_acceptance';
  end if;

  return new;
end;
$$;

create trigger contracts_enforce_acceptance
  before insert or update on contracts
  for each row execute function enforce_contract_acceptance();

-- ─────────────────────────────────────────────────────────────────
-- Policies: company_admin/platform_admin dürfen keine angenommenen Contracts löschen.
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "contracts: company_admin/platform_admin" on contracts;

create policy "contracts: admins lesen"
  on contracts for select
  using (is_company_admin(company_id) or is_platform_admin());

create policy "contracts: admins bieten an"
  on contracts for insert
  with check (is_company_admin(company_id) or is_platform_admin());

create policy "contracts: admins bearbeiten"
  on contracts for update
  using (is_company_admin(company_id) or is_platform_admin())
  with check (is_company_admin(company_id) or is_platform_admin());

create policy "contracts: admins löschen offene Angebote"
  on contracts for delete
  using (
    is_platform_admin()
    or (is_company_admin(company_id) and status in ('pending', 'declined'))
  );

-- ─────────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────────
-- Angebot per E-Mail-Adresse (die Person muss bereits ein Konto haben).
create function offer_contract(
  target_company_id uuid,
  target_email text,
  p_employment_type text,
  p_rate_model text,
  p_rate_amount numeric,
  p_valid_from date,
  p_valid_to date default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_contract_id uuid;
begin
  if not (is_platform_admin() or is_company_admin(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(target_email);
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into contracts (
    trainer_id, company_id, employment_type, rate_model, rate_amount, valid_from, valid_to, status
  ) values (
    v_user_id, target_company_id, p_employment_type, p_rate_model, p_rate_amount,
    p_valid_from, p_valid_to, 'pending'
  )
  returning id into v_contract_id;

  return v_contract_id;
end;
$$;

create function accept_contract(target_contract_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  update contracts
  set status = 'active', accepted_at = now()
  where id = target_contract_id
    and trainer_id = auth.uid()
    and status = 'pending'
    and (valid_to is null or valid_to >= current_date);

  if not found then
    raise exception 'contract_not_found_or_not_acceptable';
  end if;
end;
$$;

create function decline_contract(target_contract_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  update contracts
  set status = 'declined'
  where id = target_contract_id
    and trainer_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'contract_not_found_or_not_pending';
  end if;
end;
$$;

-- Eigene Contracts inkl. Company-Name (Trainer:innen dürfen companies nicht direkt lesen).
create function get_my_contracts()
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  employment_type text,
  rate_model text,
  rate_amount numeric,
  valid_from date,
  valid_to date,
  status text,
  accepted_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.company_id, co.name, c.employment_type, c.rate_model, c.rate_amount,
         c.valid_from, c.valid_to, c.status, c.accepted_at
  from contracts c
  join companies co on co.id = c.company_id
  where c.trainer_id = auth.uid()
  order by c.created_at desc;
$$;

revoke all on function
  offer_contract(uuid, text, text, text, numeric, date, date),
  accept_contract(uuid),
  decline_contract(uuid),
  get_my_contracts()
from public, anon;

grant execute on function
  offer_contract(uuid, text, text, text, numeric, date, date),
  accept_contract(uuid),
  decline_contract(uuid),
  get_my_contracts()
to authenticated, service_role;
