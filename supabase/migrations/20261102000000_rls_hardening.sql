-- RLS-Härtung (Nachfolger der Initial-Migration)
--
-- 1. profiles: Nutzer:innen dürfen ihr Profil nicht löschen (Kaskade auf contracts).
-- 2. companies/studios: Löschen nur für platform_admin.
-- 3. course_sessions: erfasste Kurse lassen sich sperren (locked_at); Trainer:innen
--    ändern/löschen nur offene Sessions mit aktivem Contract; Referenzen müssen zur Company passen.
-- 4. Profil-Sichtbarkeit für company_admins nur bei aktivem Contract oder erfassten Kursen.
-- 5. Hilfsfunktionen: kein EXECUTE für anon, kein Orakel mehr für fremde Contracts/Pläne.

-- ─────────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "profiles: eigene Zeile" on profiles;

create policy "profiles: eigene Zeile lesen"
  on profiles for select
  using (id = auth.uid());

create policy "profiles: eigene Zeile bearbeiten"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- 4. PROFILE-SICHTBARKEIT FÜR COMPANY-ADMINS
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "profiles: company_admin sieht eigene Trainer" on profiles;

create policy "profiles: company_admin sieht Trainer mit aktivem Contract oder erfassten Kursen"
  on profiles for select
  using (
    exists (
      select 1 from contracts c
      where c.trainer_id = profiles.id
        and is_company_admin(c.company_id)
        and c.status = 'active'
        and c.valid_from <= current_date
        and (c.valid_to is null or c.valid_to >= current_date)
    )
    or exists (
      select 1 from course_sessions cs
      join studios s on s.id = cs.studio_id
      where cs.trainer_id = profiles.id
        and is_company_admin(s.company_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 2. COMPANIES / STUDIOS: Löschen nur für platform_admin
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "companies: company_admin/platform_admin" on companies;

create policy "companies: lesen"
  on companies for select
  using (is_company_admin(id) or is_platform_admin());

create policy "companies: anlegen"
  on companies for insert
  with check (is_platform_admin());

create policy "companies: bearbeiten"
  on companies for update
  using (is_company_admin(id) or is_platform_admin())
  with check (is_company_admin(id) or is_platform_admin());

create policy "companies: löschen"
  on companies for delete
  using (is_platform_admin());

drop policy if exists "studios: company_admin/platform_admin" on studios;

create policy "studios: lesen (company_admin/platform_admin)"
  on studios for select
  using (is_company_admin(company_id) or is_platform_admin());

create policy "studios: anlegen"
  on studios for insert
  with check (is_company_admin(company_id) or is_platform_admin());

create policy "studios: bearbeiten"
  on studios for update
  using (is_company_admin(company_id) or is_platform_admin())
  with check (is_company_admin(company_id) or is_platform_admin());

create policy "studios: löschen"
  on studios for delete
  using (is_platform_admin());

-- ─────────────────────────────────────────────────────────────────
-- 5. HILFSFUNKTIONEN: Orakel schließen, EXECUTE einschränken
-- ─────────────────────────────────────────────────────────────────
create or replace function has_active_contract(target_trainer_id uuid, target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from contracts
    where trainer_id = target_trainer_id
      and company_id = target_company_id
      and status = 'active'
      and valid_from <= current_date
      and (valid_to is null or valid_to >= current_date)
  ) and (
    target_trainer_id = auth.uid()
    or is_company_admin(target_company_id)
    or is_platform_admin()
  );
$$;

create or replace function company_id_for_plan(target_plan_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select q.company_id
  from (
    select s.company_id from course_plans cp
    join studios s on s.id = cp.studio_id
    where cp.id = target_plan_id
  ) q
  where is_company_admin(q.company_id) or is_platform_admin();
$$;

revoke all on function
  is_platform_admin(),
  is_company_admin(uuid),
  has_active_contract(uuid, uuid),
  company_id_for_plan(uuid),
  add_company_admin(uuid, text),
  get_company_admins(uuid)
from public, anon;

grant execute on function
  is_platform_admin(),
  is_company_admin(uuid),
  has_active_contract(uuid, uuid),
  company_id_for_plan(uuid),
  add_company_admin(uuid, text),
  get_company_admins(uuid)
to authenticated, service_role;

-- Künftige Funktionen sind nicht mehr automatisch für anon/public ausführbar;
-- benötigte Rechte müssen mit einer Migration explizit vergeben werden.
alter default privileges in schema public revoke execute on functions from public, anon;

-- ─────────────────────────────────────────────────────────────────
-- 3. COURSE_SESSIONS: Sperren, Rechte, Referenzprüfung
-- ─────────────────────────────────────────────────────────────────
-- Gesperrte Sessions (z. B. nach Freigabe für Gutschriften) kann nur noch
-- company_admin/platform_admin ändern.
alter table course_sessions add column locked_at timestamptz;
alter table course_sessions add column locked_by uuid references profiles(id) on delete set null;

drop policy if exists "course_sessions: trainer eigene Zeilen" on course_sessions;

create policy "course_sessions: trainer liest eigene"
  on course_sessions for select
  using (trainer_id = auth.uid());

create policy "course_sessions: trainer erfasst eigene"
  on course_sessions for insert
  with check (
    trainer_id = auth.uid()
    and locked_at is null
    and locked_by is null
    and has_active_contract(auth.uid(), (select company_id from studios where studios.id = course_sessions.studio_id))
  );

create policy "course_sessions: trainer bearbeitet eigene offene"
  on course_sessions for update
  using (trainer_id = auth.uid() and locked_at is null)
  with check (
    trainer_id = auth.uid()
    and locked_at is null
    and locked_by is null
    and has_active_contract(auth.uid(), (select company_id from studios where studios.id = course_sessions.studio_id))
  );

create policy "course_sessions: trainer löscht eigene offene"
  on course_sessions for delete
  using (
    trainer_id = auth.uid()
    and locked_at is null
    and has_active_contract(auth.uid(), (select company_id from studios where studios.id = course_sessions.studio_id))
  );

-- Kurstyp und Plan-Slot müssen zur Company bzw. zum Studio der Session passen
-- (Fremdschlüssel allein prüfen das nicht und umgehen RLS).
create or replace function validate_course_session_refs()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from studios where id = new.studio_id;

  if new.course_type_id is not null and not exists (
    select 1 from course_types
    where id = new.course_type_id and company_id = v_company_id
  ) then
    raise exception 'course_type_company_mismatch';
  end if;

  if new.course_plan_slot_id is not null and not exists (
    select 1 from course_plan_slots sl
    join course_plans cp on cp.id = sl.course_plan_id
    where sl.id = new.course_plan_slot_id and cp.studio_id = new.studio_id
  ) then
    raise exception 'course_plan_slot_studio_mismatch';
  end if;

  return new;
end;
$$;

revoke all on function validate_course_session_refs() from public, anon, authenticated;

create trigger course_sessions_validate_refs
  before insert or update of studio_id, course_type_id, course_plan_slot_id on course_sessions
  for each row execute function validate_course_session_refs();
