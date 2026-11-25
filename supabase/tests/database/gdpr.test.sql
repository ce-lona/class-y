-- pgTAP-Test für DSGVO-Flows (Migration 20261125220000): Konto-Löschung durch Admins,
-- Datenauskunft (Person/Company) und Company-Offboarding mit 30 Tagen Karenz.
-- Ausführbar mit `supabase test db`; läuft in einer Transaktion und wird zurückgerollt.
begin;
select plan(41);

-- ─────────────────────────────────────────────────────────────────
-- Setup
--   Company A: Admin A1, Trainer T1 (Session), T3 (aktiver Plan), T4 (nur offenes Angebot)
--   Company B: Admin B1
--   T2 und T5: Contracts bei A und B
-- ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000009001', 'pa@gdpr.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000090a1', 'admin-a@gdpr.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000090b1', 'admin-b@gdpr.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000090c1', 't1@gdpr.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000090c2', 't2@gdpr.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000090c3', 't3@gdpr.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000090c4', 't4@gdpr.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000090c5', 't5@gdpr.test', 'authenticated', 'authenticated');

insert into platform_admins (user_id) values ('00000000-0000-0000-0000-000000009001');

update profiles set full_name = 'Tina Eins', phone = '+49 1', street = 'Weg', city = 'Köln'
where id = '00000000-0000-0000-0000-0000000090c1';

insert into companies (id, name) values
  ('00000000-0000-0000-0000-00000000a901', 'GDPR A'),
  ('00000000-0000-0000-0000-00000000a902', 'GDPR B');

insert into company_admins (user_id, company_id) values
  ('00000000-0000-0000-0000-0000000090a1', '00000000-0000-0000-0000-00000000a901'),
  ('00000000-0000-0000-0000-0000000090b1', '00000000-0000-0000-0000-00000000a902');

insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-00000000b901', '00000000-0000-0000-0000-00000000a901', 'Studio A'),
  ('00000000-0000-0000-0000-00000000b902', '00000000-0000-0000-0000-00000000a902', 'Studio B');

insert into course_types (id, company_id, name, default_duration_min) values
  ('00000000-0000-0000-0000-00000000c901', '00000000-0000-0000-0000-00000000a901', 'Yoga', 60),
  ('00000000-0000-0000-0000-00000000c902', '00000000-0000-0000-0000-00000000a902', 'Spin', 45);

insert into contracts (trainer_id, company_id, employment_type, rate_model, rate_amount, valid_from, status, accepted_at)
values
  ('00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-00000000a901', 'freelancer', 'per_course', 40, current_date - 30, 'active', now()),
  ('00000000-0000-0000-0000-0000000090c2', '00000000-0000-0000-0000-00000000a901', 'freelancer', 'per_course', 40, current_date - 30, 'active', now()),
  ('00000000-0000-0000-0000-0000000090c2', '00000000-0000-0000-0000-00000000a902', 'freelancer', 'per_course', 50, current_date - 30, 'active', now()),
  ('00000000-0000-0000-0000-0000000090c3', '00000000-0000-0000-0000-00000000a901', 'freelancer', 'per_course', 40, current_date - 30, 'active', now()),
  ('00000000-0000-0000-0000-0000000090c5', '00000000-0000-0000-0000-00000000a901', 'freelancer', 'per_course', 40, current_date - 30, 'active', now()),
  ('00000000-0000-0000-0000-0000000090c5', '00000000-0000-0000-0000-00000000a902', 'freelancer', 'per_course', 50, current_date - 30, 'active', now());

insert into contracts (trainer_id, company_id, employment_type, rate_model, rate_amount, valid_from, status)
values ('00000000-0000-0000-0000-0000000090c4', '00000000-0000-0000-0000-00000000a901', 'minijob', 'hourly', 15, current_date, 'pending');

insert into course_sessions (studio_id, course_type_id, date, start_time, end_time, trainer_id, status)
values
  ('00000000-0000-0000-0000-00000000b901', '00000000-0000-0000-0000-00000000c901', current_date - 3, '10:00', '11:00', '00000000-0000-0000-0000-0000000090c1', 'completed'),
  ('00000000-0000-0000-0000-00000000b902', '00000000-0000-0000-0000-00000000c902', current_date - 3, '10:00', '10:45', '00000000-0000-0000-0000-0000000090c5', 'completed');

insert into course_plans (id, studio_id, valid_from, status)
values ('00000000-0000-0000-0000-00000000d901', '00000000-0000-0000-0000-00000000b901', current_date - 7, 'active');

insert into course_plan_slots (course_plan_id, weekday, start_time, end_time, course_type_id, trainer_id)
values ('00000000-0000-0000-0000-00000000d901', 1, '18:00', '19:00', '00000000-0000-0000-0000-00000000c901', '00000000-0000-0000-0000-0000000090c3');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Konto-Löschung: Berechtigungen
-- ─────────────────────────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000090c1');

select throws_ok(
  $$ select admin_delete_user('00000000-0000-0000-0000-0000000090c4') $$,
  'not_authorized',
  'Trainer:in kann keine Konten löschen'
);

select throws_ok(
  $$ select admin_delete_user('00000000-0000-0000-0000-0000000090c1') $$,
  'not_authorized',
  'Trainer:in kann sich nicht selbst löschen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090a1');

select throws_ok(
  $$ select admin_delete_user('00000000-0000-0000-0000-0000000090a1') $$,
  'cannot_delete_self',
  'Company-Admin kann sich nicht selbst löschen'
);

select throws_ok(
  $$ select admin_delete_user('00000000-0000-0000-0000-0000000090c2') $$,
  'user_belongs_to_other_company',
  'Company-Admin kann keine Person löschen, die auch an eine andere Company gebunden ist'
);

select throws_ok(
  $$ select admin_delete_user('00000000-0000-0000-0000-000000009001') $$,
  'not_authorized',
  'Company-Admin kann keinen Platform-Admin löschen'
);

select throws_ok(
  $$ select admin_delete_user('00000000-0000-0000-0000-0000000090c3') $$,
  'user_in_active_course_plan',
  'Trainer:in in aktivem Kursplan muss vor dem Löschen ausgeplant werden'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090b1');

select throws_ok(
  $$ select admin_delete_user('00000000-0000-0000-0000-0000000090c1') $$,
  'not_authorized',
  'Company-Admin B kann Trainer:in von Company A nicht löschen'
);

-- ─────────────────────────────────────────────────────────────────
-- Datenauskunft Person
-- ─────────────────────────────────────────────────────────────────
select throws_ok(
  $$ select export_user_data('00000000-0000-0000-0000-0000000090c3') $$,
  'not_authorized',
  'Company-Admin B bekommt keine Auskunft über Trainer:in von Company A'
);

select is(
  jsonb_array_length(export_user_data('00000000-0000-0000-0000-0000000090c2') -> 'contracts'),
  1,
  'Company-Admin B sieht in der Auskunft nur den Contract der eigenen Company'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-000000009001');

select is(
  jsonb_array_length(export_user_data('00000000-0000-0000-0000-0000000090c2') -> 'contracts'),
  2,
  'Platform-Admin sieht in der Auskunft alle Contracts'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090a1');

select is(
  export_user_data('00000000-0000-0000-0000-0000000090c1') #>> '{account,email}',
  't1@gdpr.test',
  'Auskunft enthält die E-Mail-Adresse'
);

select is(
  jsonb_array_length(export_user_data('00000000-0000-0000-0000-0000000090c1') -> 'course_sessions'),
  1,
  'Auskunft enthält erfasste Kurse'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090c1');

select throws_ok(
  $$ select export_user_data('00000000-0000-0000-0000-0000000090c1') $$,
  'not_authorized',
  'Trainer:in kann die Auskunft nicht selbst ziehen (läuft über Admins)'
);

-- ─────────────────────────────────────────────────────────────────
-- Datenexport Company
-- ─────────────────────────────────────────────────────────────────
select throws_ok(
  $$ select export_company_data('00000000-0000-0000-0000-00000000a901') $$,
  'not_authorized',
  'Trainer:in kann keine Company exportieren'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090b1');

select throws_ok(
  $$ select export_company_data('00000000-0000-0000-0000-00000000a901') $$,
  'not_authorized',
  'Company-Admin B kann Company A nicht exportieren'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090a1');

select is(
  (select jsonb_build_array(
     jsonb_array_length(d -> 'studios'),
     jsonb_array_length(d -> 'contracts'),
     jsonb_array_length(d -> 'course_sessions'),
     jsonb_array_length(d -> 'people'))
   from export_company_data('00000000-0000-0000-0000-00000000a901') d),
  '[1, 5, 1, 6]'::jsonb,
  'Company-Export enthält Studios, Contracts, Kurse und beteiligte Personen der Company'
);

-- ─────────────────────────────────────────────────────────────────
-- Datenschutz-Übersicht (Personen einer Company)
-- ─────────────────────────────────────────────────────────────────
select is(
  (select jsonb_object_agg(email, coalesce(delete_blocked_reason, '-'))
   from get_company_people('00000000-0000-0000-0000-00000000a901')),
  jsonb_build_object(
    'admin-a@gdpr.test', 'self',
    't1@gdpr.test', '-',
    't2@gdpr.test', 'other_company',
    't3@gdpr.test', 'active_plan',
    't4@gdpr.test', '-',
    't5@gdpr.test', 'other_company'
  ),
  'Personenliste zeigt alle Konten der Company inkl. Löschsperren'
);

select is(
  (select roles from get_company_people('00000000-0000-0000-0000-00000000a901')
   where email = 'admin-a@gdpr.test'),
  array['company_admin'],
  'Personenliste nennt die Rollen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090b1');

select throws_ok(
  $$ select * from get_company_people('00000000-0000-0000-0000-00000000a901') $$,
  'not_authorized',
  'Company-Admin B sieht die Personenliste von Company A nicht'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090a1');

-- ─────────────────────────────────────────────────────────────────
-- Konto-Löschung: Durchführung
-- ─────────────────────────────────────────────────────────────────
select is(
  admin_delete_user('00000000-0000-0000-0000-0000000090c1'),
  'anonymized',
  'Company-Admin löscht Trainer:in mit erfassten Kursen → Profil wird anonymisiert'
);

select is(
  admin_delete_user('00000000-0000-0000-0000-0000000090c4'),
  'deleted',
  'Company-Admin löscht Person ohne aufbewahrungspflichtige Daten → Profil wird gelöscht'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-000000009001');

select is(
  admin_delete_user('00000000-0000-0000-0000-0000000090c2'),
  'anonymized',
  'Platform-Admin kann auch companyübergreifende Konten löschen'
);

reset role;

select is(
  (select count(*)::int from auth.users where id in (
    '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090c2',
    '00000000-0000-0000-0000-0000000090c4')),
  0,
  'Logins (auth.users) der gelöschten Konten sind entfernt'
);

select is(
  (select jsonb_build_object('n', full_name, 'p', phone, 's', street, 'c', city, 'd', deleted_at is not null)
   from profiles where id = '00000000-0000-0000-0000-0000000090c1'),
  '{"n": "Gelöschtes Konto", "p": null, "s": null, "c": null, "d": true}'::jsonb,
  'Anonymisiertes Profil enthält keine Stammdaten mehr'
);

select ok(
  not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000090c4'),
  'Profil ohne aufbewahrungspflichtige Daten ist hart gelöscht'
);

select is(
  (select count(*)::int from course_sessions where trainer_id = '00000000-0000-0000-0000-0000000090c1'),
  1,
  'Erfasste Kurse bleiben für die Abrechnung erhalten'
);

select is(
  (select status || ':' || (valid_to = current_date)::text from contracts
   where trainer_id = '00000000-0000-0000-0000-0000000090c1'),
  'ended:true',
  'Laufender Contract endet mit dem Löschtag'
);

select ok(
  not exists (select 1 from contracts where trainer_id = '00000000-0000-0000-0000-0000000090c4'),
  'Offene Vertragsangebote werden gelöscht'
);

select is(
  (select count(*)::int from gdpr_audit_log
   where action = 'user_deleted' and subject_id = '00000000-0000-0000-0000-0000000090c1'
     and actor_id = '00000000-0000-0000-0000-0000000090a1'),
  1,
  'Löschung ist im Löschprotokoll vermerkt'
);

-- Löschen direkt in auth.users (z. B. über das Dashboard) räumt das Profil ebenfalls auf
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000090d1', 'dash@gdpr.test', 'authenticated', 'authenticated');
delete from auth.users where id = '00000000-0000-0000-0000-0000000090d1';

select ok(
  not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000090d1'),
  'Löschen in auth.users entfernt auch das Profil'
);

-- ─────────────────────────────────────────────────────────────────
-- Schutz der Lösch-/Offboarding-Felder
-- ─────────────────────────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000090c3');

select throws_ok(
  $$ update profiles set deleted_at = now() where id = '00000000-0000-0000-0000-0000000090c3' $$,
  'profile_deleted_at_readonly',
  'Nutzer:innen können deleted_at nicht selbst setzen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000090a1');

select throws_ok(
  $$ update companies set deletion_scheduled_for = null, deletion_requested_at = now()
     where id = '00000000-0000-0000-0000-00000000a901' $$,
  'company_deletion_fields_readonly',
  'Company-Admin kann Offboarding-Felder nicht direkt ändern'
);

-- ─────────────────────────────────────────────────────────────────
-- Offboarding
-- ─────────────────────────────────────────────────────────────────
select throws_ok(
  $$ select schedule_company_deletion('00000000-0000-0000-0000-00000000a901') $$,
  'not_authorized',
  'Company-Admin kann das Offboarding nicht auslösen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-000000009001');

select ok(
  abs(extract(epoch from
    schedule_company_deletion('00000000-0000-0000-0000-00000000a901') - (now() + interval '30 days'))) < 60,
  'Platform-Admin plant Löschung mit 30 Tagen Karenz'
);

select throws_ok(
  $$ select schedule_company_deletion('00000000-0000-0000-0000-00000000a901') $$,
  'company_deletion_already_scheduled',
  'Doppeltes Einplanen wird abgelehnt'
);

select is(
  purge_due_company_deletions(),
  0,
  'Innerhalb der Karenzzeit wird nichts gelöscht'
);

select lives_ok(
  $$ select cancel_company_deletion('00000000-0000-0000-0000-00000000a901') $$,
  'Platform-Admin kann das Offboarding zurücknehmen'
);

select schedule_company_deletion('00000000-0000-0000-0000-00000000a901');

-- Karenzzeit künstlich ablaufen lassen (als postgres, Guard greift nur für Endnutzer:innen)
reset role;
update companies set deletion_scheduled_for = now() - interval '1 day'
where id = '00000000-0000-0000-0000-00000000a901';

select pg_temp.login('00000000-0000-0000-0000-000000009001');

select is(
  purge_due_company_deletions(),
  1,
  'Nach Ablauf der Karenzzeit wird die Company gelöscht'
);

reset role;

select ok(
  not exists (select 1 from companies where id = '00000000-0000-0000-0000-00000000a901')
  and not exists (select 1 from studios where id = '00000000-0000-0000-0000-00000000b901')
  and not exists (select 1 from course_types where company_id = '00000000-0000-0000-0000-00000000a901'),
  'Company, Studios und Kurstypen sind hart gelöscht'
);

select ok(
  not exists (select 1 from auth.users where id in (
    '00000000-0000-0000-0000-0000000090a1', '00000000-0000-0000-0000-0000000090c3'))
  and not exists (select 1 from profiles where id in (
    '00000000-0000-0000-0000-0000000090a1', '00000000-0000-0000-0000-0000000090c3', '00000000-0000-0000-0000-0000000090c1')),
  'Konten, die nur an die Company gebunden waren, sind vollständig gelöscht'
);

select ok(
  exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000090c5')
  and exists (select 1 from contracts where trainer_id = '00000000-0000-0000-0000-0000000090c5'
              and company_id = '00000000-0000-0000-0000-00000000a902')
  and exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000090b1'),
  'Konten und Daten anderer Companies bleiben unberührt'
);

select * from finish();
rollback;
