-- pgTAP-Test für das erweiterte Rollenmodell (Migration 20261128150000):
-- Rechte der Studio-Admins (darf / darf nicht / mit Bestätigung), Vertragsbestätigung,
-- Studio-Freigabe für Trainer:innen, Kurstypen mit Bestätigung, Abrechnung, Plattform-Admins.
begin;
select plan(39);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000009a1', 'admin@perm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000009a2', 'studio-admin@perm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000009b1', 'trainer-a@perm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000009b2', 'trainer-b@perm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000009d1', 'platform@perm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000009d2', 'staff@perm.test', 'authenticated', 'authenticated');

insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000009d1');

insert into companies (id, name) values ('00000000-0000-0000-0000-00000000a901', 'Perm Company');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-00000000a901');

insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-00000000b901', '00000000-0000-0000-0000-00000000a901', 'Studio A'),
  ('00000000-0000-0000-0000-00000000b902', '00000000-0000-0000-0000-00000000a901', 'Studio B');

insert into studio_coordinators (user_id, studio_id)
values ('00000000-0000-0000-0000-0000000009a2', '00000000-0000-0000-0000-00000000b901');

-- Company-weiter Kurstyp (gehört dem Company-Admin)
insert into course_types (id, company_id, name, default_duration_min)
values ('00000000-0000-0000-0000-00000000c901', '00000000-0000-0000-0000-00000000a901', 'Cycling', 45);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create temp table tmp_ids (k text primary key, id uuid);
grant all on tmp_ids to authenticated;

-- ─── Standardrechte ───────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000009a2');

select is(
  (select row(course_types, contracts, billing)::text from get_studio_admin_permissions('00000000-0000-0000-0000-00000000a901')),
  '(approval,approval,denied)',
  'Standard: Kurstypen und Verträge mit Bestätigung, Abrechnung darf nicht'
);

select throws_ok(
  $$ select set_studio_admin_permissions('00000000-0000-0000-0000-00000000a901', 'allowed', 'allowed', 'allowed') $$,
  'P0001', 'not_authorized',
  'Studio-Admin kann seine eigenen Rechte nicht ändern'
);

-- ─── Verträge mit Bestätigung ─────────────────────────────────────
insert into tmp_ids select 'ca', offer_contract(
  '00000000-0000-0000-0000-00000000a901', 'trainer-a@perm.test',
  'freelancer', 'per_course', 40, current_date - 5, null, null
);

select is(
  (select approval_status from get_company_contracts('00000000-0000-0000-0000-00000000a901') where id = (select id from tmp_ids where k = 'ca')),
  'pending_approval',
  'Vertragsangebot eines Studio-Admins wartet auf Bestätigung'
);

select is(
  (select created_by_name from get_company_contracts('00000000-0000-0000-0000-00000000a901') where id = (select id from tmp_ids where k = 'ca')),
  'studio-admin@perm.test',
  'Company-Admin sieht, wer das Angebot erstellt hat'
);

select throws_ok(
  $$ select review_contract((select id from tmp_ids where k = 'ca'), true) $$,
  'P0001', 'not_authorized',
  'Studio-Admin kann sein eigenes Angebot nicht bestätigen'
);

update contracts set approval_status = 'approved' where id = (select id from tmp_ids where k = 'ca');

select is(
  (select approval_status from get_company_contracts('00000000-0000-0000-0000-00000000a901') where id = (select id from tmp_ids where k = 'ca')),
  'pending_approval',
  'Studio-Admin kann die Bestätigung nicht direkt setzen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009b1');

select is(
  (select count(*)::int from get_my_contracts()),
  0,
  'Trainer:in sieht ein unbestätigtes Angebot nicht'
);

select throws_ok(
  $$ select accept_contract((select id from tmp_ids where k = 'ca')) $$,
  'P0001', null,
  'Trainer:in kann ein unbestätigtes Angebot nicht annehmen'
);

-- Company-Admin bestätigt und beschränkt auf Studio A
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');

select lives_ok(
  $$ select review_contract((select id from tmp_ids where k = 'ca'), true,
       array['00000000-0000-0000-0000-00000000b901'::uuid]) $$,
  'Company-Admin bestätigt das Angebot und beschränkt es auf Studio A'
);

-- Trainer B: company-weiter Vertrag vom Company-Admin (sofort bestätigt)
insert into tmp_ids select 'cb', offer_contract(
  '00000000-0000-0000-0000-00000000a901', 'trainer-b@perm.test',
  'freelancer', 'per_course', 50, current_date - 5, null, null
);

select is(
  (select approval_status from get_company_contracts('00000000-0000-0000-0000-00000000a901') where id = (select id from tmp_ids where k = 'cb')),
  'approved',
  'Angebote des Company-Admins sind sofort bestätigt'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009b1');
select accept_contract((select id from tmp_ids where k = 'ca'));
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009b2');
select accept_contract((select id from tmp_ids where k = 'cb'));

-- ─── Studio-Freigabe für Trainer:innen ───────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009b1');

select is(
  (select array_agg(studio_name order by studio_name) from get_trainer_studios()),
  array['Studio A']::text[],
  'Auf Studio A beschränkte Trainer:in sieht nur Studio A'
);

select is(
  (select count(*)::int from studios where company_id = '00000000-0000-0000-0000-00000000a901'),
  1,
  'RLS: beschränkte Trainer:in liest nur Studio A'
);

select throws_ok(
  $$ insert into course_sessions (trainer_id, studio_id, course_type_id, date, start_time, end_time, status)
     values ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-00000000b902',
             '00000000-0000-0000-0000-00000000c901', current_date, '10:00', '10:45', 'completed') $$,
  '42501', null,
  'Beschränkte Trainer:in kann keinen Kurs in Studio B erfassen'
);

select lives_ok(
  $$ insert into course_sessions (trainer_id, studio_id, course_type_id, date, start_time, end_time, status)
     values ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-00000000b901',
             '00000000-0000-0000-0000-00000000c901', current_date, '10:00', '10:45', 'completed') $$,
  'Beschränkte Trainer:in kann Kurse in Studio A erfassen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009b2');

select is(
  (select count(*)::int from get_trainer_studios()),
  2,
  'Company-weiter Vertrag: Trainer:in sieht alle Studios'
);

-- Studio-Admin sieht company-weite Verträge (zum Einplanen) und plant Trainer B in Studio A ein
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a2');

select is(
  (select count(*)::int from get_company_active_trainers('00000000-0000-0000-0000-00000000a901')),
  2,
  'Studio-Admin sieht die für sein Studio freigegebenen Trainer:innen'
);

select lives_ok(
  $$ insert into tmp_ids select 'plan_a', publish_course_plan(
       '00000000-0000-0000-0000-00000000b901', current_date - 2,
       jsonb_build_array(jsonb_build_object(
         'weekday', extract(isodow from current_date)::int,
         'start_time', '18:00', 'end_time', '18:45',
         'course_type_id', '00000000-0000-0000-0000-00000000c901',
         'trainer_id', '00000000-0000-0000-0000-0000000009b2'
       ))
     ) $$,
  'Studio-Admin plant eine company-weite Trainer:in in Studio A ein'
);

-- Company-Admin veröffentlicht Plan in Studio B: beschränkte Trainer A darf dort nicht eingeplant werden
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');

select throws_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000b902', current_date - 2,
       jsonb_build_array(jsonb_build_object(
         'weekday', 1, 'start_time', '09:00', 'end_time', '09:45',
         'course_type_id', '00000000-0000-0000-0000-00000000c901',
         'trainer_id', '00000000-0000-0000-0000-0000000009b1'
       ))
     ) $$,
  'P0001', 'trainer_without_active_contract',
  'Auf Studio A beschränkte Trainer:in kann nicht in Studio B eingeplant werden'
);

select is(
  (select count(*)::int from get_company_colleagues('00000000-0000-0000-0000-00000000a901', '00000000-0000-0000-0000-00000000b902')),
  1,
  'Vertretungsliste für Studio B enthält nur freigegebene Trainer:innen'
);

-- Vertretung in Studio A durch Trainer A ist erlaubt, Studio-B-Slot (Plan oben) wäre es nicht.
select lives_ok(
  $$ select request_substitution(
       (select sl.id from course_plan_slots sl where sl.course_plan_id = (select id from tmp_ids where k = 'plan_a')),
       current_date + 7, '00000000-0000-0000-0000-0000000009b1') $$,
  'Vertretung durch eine für das Studio freigegebene Trainer:in ist möglich'
);

select lives_ok(
  $$ select set_contract_studios((select id from tmp_ids where k = 'ca'),
       array['00000000-0000-0000-0000-00000000b902'::uuid]) $$,
  'Company-Admin ändert die Studio-Beschränkung'
);

select throws_ok(
  $$ select request_substitution(
       (select sl.id from course_plan_slots sl where sl.course_plan_id = (select id from tmp_ids where k = 'plan_a')),
       current_date + 14, '00000000-0000-0000-0000-0000000009b1') $$,
  'P0001', 'substitute_not_cleared_for_studio',
  'Vertretung durch eine nicht freigegebene Trainer:in wird abgelehnt'
);

-- ─── Vertragsrecht: darf nicht / darf ────────────────────────────
select set_studio_admin_permissions('00000000-0000-0000-0000-00000000a901', 'approval', 'denied', 'denied');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a2');

select throws_ok(
  $$ select offer_contract('00000000-0000-0000-0000-00000000a901', 'trainer-b@perm.test',
       'freelancer', 'per_course', 45, current_date, null, null) $$,
  'P0001', 'not_authorized',
  'Recht „darf nicht“: Studio-Admin kann keine Verträge anbieten'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
select set_studio_admin_permissions('00000000-0000-0000-0000-00000000a901', 'approval', 'allowed', 'denied');

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a2');
insert into tmp_ids select 'cc', offer_contract('00000000-0000-0000-0000-00000000a901', 'trainer-b@perm.test',
  'minijob', 'hourly', 15, current_date + 30, null, null);

select is(
  (select approval_status from get_company_contracts('00000000-0000-0000-0000-00000000a901') where id = (select id from tmp_ids where k = 'cc')),
  'approved',
  'Recht „darf“: Angebot des Studio-Admins ist sofort bestätigt'
);

-- ─── Kurstypen mit Bestätigung ───────────────────────────────────
insert into tmp_ids select 'ct', id from studio_admin_save_course_type(
  '00000000-0000-0000-0000-00000000a901', null, 'Yoga', 60,
  array['00000000-0000-0000-0000-00000000b901'::uuid]);

select is(
  (select approval_status from course_types where id = (select id from tmp_ids where k = 'ct')),
  'pending_approval',
  'Neuer Kurstyp eines Studio-Admins wartet auf Bestätigung'
);

select throws_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000b901', current_date,
       jsonb_build_array(jsonb_build_object(
         'weekday', 2, 'start_time', '18:00', 'end_time', '19:00',
         'course_type_id', (select id from tmp_ids where k = 'ct'),
         'trainer_id', '00000000-0000-0000-0000-0000000009b2'
       ))
     ) $$,
  'P0001', 'course_type_not_approved',
  'Unbestätigter Kurstyp kann nicht eingeplant werden'
);

select throws_ok(
  $$ select studio_admin_save_course_type('00000000-0000-0000-0000-00000000a901',
       '00000000-0000-0000-0000-00000000c901', 'Spinning', 45,
       array['00000000-0000-0000-0000-00000000b901'::uuid]) $$,
  'P0001', 'course_type_studios_not_managed',
  'Studio-Admin kann company-weite Kurstypen nicht ändern'
);

select throws_ok(
  $$ select studio_admin_save_course_type('00000000-0000-0000-0000-00000000a901', null, 'Pilates', 50,
       array['00000000-0000-0000-0000-00000000b902'::uuid]) $$,
  'P0001', 'course_type_studios_not_managed',
  'Studio-Admin kann keine Kurstypen für fremde Studios anlegen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009b2');

select is(
  (select count(*)::int from course_types where id = (select id from tmp_ids where k = 'ct')),
  0,
  'Trainer:innen sehen unbestätigte Kurstypen nicht'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
select review_course_type((select id from tmp_ids where k = 'ct'), true);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a2');
select studio_admin_save_course_type('00000000-0000-0000-0000-00000000a901',
  (select id from tmp_ids where k = 'ct'), 'Yoga Flow', 75,
  array['00000000-0000-0000-0000-00000000b901'::uuid]);

select is(
  (select name || '|' || (pending_change ->> 'name') from course_types where id = (select id from tmp_ids where k = 'ct')),
  'Yoga|Yoga Flow',
  'Änderung an einem bestätigten Kurstyp wird erst vorgeschlagen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
select review_course_type((select id from tmp_ids where k = 'ct'), true);

select is(
  (select name || '|' || default_duration_min || '|' || coalesce(pending_change::text, '-') from course_types where id = (select id from tmp_ids where k = 'ct')),
  'Yoga Flow|75|-',
  'Company-Admin bestätigt die Änderung'
);

select set_studio_admin_permissions('00000000-0000-0000-0000-00000000a901', 'denied', 'allowed', 'denied');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009a2');

select throws_ok(
  $$ select studio_admin_delete_course_type((select id from tmp_ids where k = 'ct')) $$,
  'P0001', 'not_authorized',
  'Recht „darf nicht“: Studio-Admin kann keine Kurstypen löschen'
);

-- ─── Abrechnung bei nicht getrennter Abrechnung ─────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000009a2', 'role', 'authenticated')::text, true);

select is(
  billing_can_issue('00000000-0000-0000-0000-00000000a901', null),
  false,
  'Recht „darf nicht“: Studio-Admin stellt keine company-weiten Abrechnungen aus'
);

insert into studio_admin_permissions (company_id, course_types, contracts, billing)
values ('00000000-0000-0000-0000-00000000a901', 'denied', 'allowed', 'allowed')
on conflict (company_id) do update set billing = 'allowed';

select is(
  billing_can_issue('00000000-0000-0000-0000-00000000a901', null),
  true,
  'Recht „darf“: Studio-Admin stellt company-weite Abrechnungen aus'
);

-- ─── Mehrere Plattform-Admins ───────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');

select throws_ok(
  $$ select add_platform_admin('admin@perm.test') $$,
  'P0001', 'not_authorized',
  'Company-Admin kann sich nicht zum Plattform-Admin machen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000009d1');

select lives_ok(
  $$ select add_platform_admin('staff@perm.test') $$,
  'Plattform-Admin fügt eine Mitarbeiterin als Plattform-Admin hinzu'
);

select is(
  (select array_agg(email order by email) from get_platform_admins()),
  array['platform@perm.test', 'staff@perm.test']::text[],
  'Beide Plattform-Admins werden gelistet'
);

select lives_ok(
  $$ select remove_platform_admin('00000000-0000-0000-0000-0000000009d2') $$,
  'Plattform-Admin entfernt eine Mitarbeiterin wieder'
);

select throws_ok(
  $$ select remove_platform_admin('00000000-0000-0000-0000-0000000009d1') $$,
  'P0001', 'last_platform_admin',
  'Der letzte Plattform-Admin kann nicht entfernt werden'
);

select * from finish();
rollback;
