-- pgTAP-Test für Trainer-Kurserfassung (Migration 20261125003000),
-- ausführbar mit `supabase test db`. Läuft in einer Transaktion und wird zurückgerollt.
begin;
select plan(11);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000003a1', 'admin@sessions.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000003b1', 'sabine@sessions.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000003b2', 'marco@sessions.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000003c1', 'outsider@sessions.test', 'authenticated', 'authenticated');

update profiles set full_name = 'Sabine K.' where id = '00000000-0000-0000-0000-0000000003b1';
update profiles set full_name = 'Marco T.' where id = '00000000-0000-0000-0000-0000000003b2';

insert into companies (id, name) values ('00000000-0000-0000-0000-00000000a0a0', 'Sessions Studio GmbH');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-00000000a0a0');
insert into studios (id, company_id, name)
values ('00000000-0000-0000-0000-00000000b0b0', '00000000-0000-0000-0000-00000000a0a0', 'Studio Mitte');
insert into course_types (id, company_id, name, default_duration_min)
values ('00000000-0000-0000-0000-00000000c1c1', '00000000-0000-0000-0000-00000000a0a0', 'Yoga Flow', 60);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Beide Trainer bekommen aktive Verträge
select pg_temp.login('00000000-0000-0000-0000-0000000003a1');

create temp table tmp_sess (k text primary key, id uuid);
grant all on tmp_sess to authenticated;

insert into tmp_sess
select 'c1', offer_contract('00000000-0000-0000-0000-00000000a0a0', 'sabine@sessions.test', 'freelancer', 'per_course', 45, current_date, null);
insert into tmp_sess
select 'c2', offer_contract('00000000-0000-0000-0000-00000000a0a0', 'marco@sessions.test', 'freelancer', 'per_course', 45, current_date, null);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000003b1');
select accept_contract((select id from tmp_sess where k = 'c1'));

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000003b2');
select accept_contract((select id from tmp_sess where k = 'c2'));

-- Admin veröffentlicht Plan mit Slot für Sabine
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
insert into tmp_sess
select 'plan', publish_course_plan(
  '00000000-0000-0000-0000-00000000b0b0',
  current_date,
  '[{"weekday":1,"start_time":"18:00","end_time":"19:00","course_type_id":"00000000-0000-0000-0000-00000000c1c1","trainer_id":"00000000-0000-0000-0000-0000000003b1"}]'::jsonb
);
insert into tmp_sess
select 'slot', id from course_plan_slots where course_plan_id = (select id from tmp_sess where k = 'plan') limit 1;

-- 1. Sabine sieht ihren eigenen Slot und erfasst ihn als gegeben (is_substitution = false)
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000003b1');

select is(
  (select count(*) from get_trainer_studio_slots()),
  1::bigint,
  'Trainer:in mit aktivem Vertrag sieht aktive Studio-Slots'
);

insert into course_sessions (studio_id, course_plan_slot_id, date, start_time, end_time, trainer_id, is_substitution, status)
values (
  '00000000-0000-0000-0000-00000000b0b0',
  (select id from tmp_sess where k = 'slot'),
  current_date,
  '18:00',
  '19:00',
  '00000000-0000-0000-0000-0000000003b1',
  true, -- absichtlich falsch übergeben: Trigger muss false ableiten
  'completed'
);

select is(
  (select is_substitution from get_my_course_sessions(null, null) limit 1),
  false,
  'Eigener Plan-Slot wird serverseitig mit is_substitution = false gespeichert'
);

select is(
  (select course_type_name from get_my_course_sessions(null, null) limit 1),
  'Yoga Flow',
  'Kurstyp wird bei Plan-Slot-Session automatisch aus dem Slot übernommen'
);

-- Doppelte Erfassung desselben Slots am selben Tag durch dieselbe Trainer:in scheitert
select throws_ok(
  format(
    $$ insert into course_sessions (studio_id, course_plan_slot_id, date, start_time, end_time, trainer_id, status)
       values ('00000000-0000-0000-0000-00000000b0b0', %L, current_date, '18:00', '19:00', '00000000-0000-0000-0000-0000000003b1', 'completed') $$,
    (select id from tmp_sess where k = 'slot')
  ),
  '23505', null,
  'Doppelte Erfassung desselben Slots am selben Tag wird verhindert'
);

-- 2. Marco vertritt Sabines Slot spontan -> is_substitution wird automatisch true!
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000003b2');

insert into course_sessions (studio_id, course_plan_slot_id, date, start_time, end_time, trainer_id, is_substitution, status)
values (
  '00000000-0000-0000-0000-00000000b0b0',
  (select id from tmp_sess where k = 'slot'),
  current_date + 7,
  '18:00',
  '19:00',
  '00000000-0000-0000-0000-0000000003b2',
  false, -- absichtlich falsch übergeben: Trigger muss true ableiten
  'completed'
);

select is(
  (select is_substitution from get_my_course_sessions(null, null) where date = current_date + 7),
  true,
  'Fremder Plan-Slot setzt is_substitution serverseitig automatisch auf true'
);

select is(
  (select scheduled_trainer_name from get_my_course_sessions(null, null) where date = current_date + 7),
  'Sabine K.',
  'Vertretung zeigt den Namen der ursprünglich geplanten Trainer:in'
);

-- 3. Marco erfasst einen Ad-hoc-Kurs (ohne Slot)
insert into course_sessions (studio_id, course_plan_slot_id, course_type_id, date, start_time, end_time, trainer_id, is_substitution, status, notes)
values (
  '00000000-0000-0000-0000-00000000b0b0',
  null,
  '00000000-0000-0000-0000-00000000c1c1',
  current_date + 1,
  '10:00',
  '11:00',
  '00000000-0000-0000-0000-0000000003b2',
  true,
  'completed',
  'Sonderkurs'
);

select is(
  (select count(*) from get_my_course_sessions(null, null)),
  2::bigint,
  'Marco sieht genau seine 2 eigenen Sessions (Vertretung + Ad-hoc), nicht Sabines'
);

select is(
  (select is_substitution from get_my_course_sessions(null, null) where course_plan_slot_id is null),
  true,
  'Ad-hoc-Kurs behält manuelles is_substitution = true'
);

-- 4. Außenstehende Person ohne Vertrag sieht weder Studios noch Slots und darf keine Session anlegen
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000003c1');

select is(
  (select count(*) from get_trainer_studios()),
  0::bigint,
  'Außenstehende Person sieht keine Trainer-Studios'
);

select is(
  (select count(*) from get_trainer_studio_slots()),
  0::bigint,
  'Außenstehende Person sieht keine Trainer-Slots'
);

select throws_ok(
  $$ insert into course_sessions (studio_id, course_type_id, date, start_time, end_time, trainer_id, status)
     values ('00000000-0000-0000-0000-00000000b0b0', '00000000-0000-0000-0000-00000000c1c1', current_date, '12:00', '13:00', '00000000-0000-0000-0000-0000000003c1', 'completed') $$,
  '42501', null,
  'Außenstehende Person ohne aktiven Vertrag darf keine Session anlegen'
);

select * from finish();
rollback;
