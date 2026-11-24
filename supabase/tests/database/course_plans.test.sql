-- pgTAP-Test für Kurstypen & atomare Kursplan-Versionierung (Migration 20261125001000),
-- ausführbar mit `supabase test db`. Läuft in einer Transaktion und wird zurückgerollt.
begin;
select plan(12);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000002a1', 'admin@plans.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000002b1', 'trainer@plans.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000002c1', 'other@plans.test', 'authenticated', 'authenticated');

update profiles set full_name = 'Sabine Kurs' where id = '00000000-0000-0000-0000-0000000002b1';

insert into companies (id, name) values
  ('00000000-0000-0000-0000-00000000e0e0', 'Plans Company A'),
  ('00000000-0000-0000-0000-00000000e0e1', 'Plans Company B');

insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-00000000e0e0');

insert into studios (id, company_id, name)
values ('00000000-0000-0000-0000-00000000f0f0', '00000000-0000-0000-0000-00000000e0e0', 'Studio Mitte');

insert into course_types (id, company_id, name, default_duration_min) values
  ('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-00000000e0e0', 'Yoga Flow', 60),
  ('00000000-0000-0000-0000-000000002222', '00000000-0000-0000-0000-00000000e0e1', 'Fremder Kurs', 45);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Aktiven Vertrag über den normalen Angebots-/Annahme-Flow herstellen
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');

create temp table tmp_ids (k text primary key, id uuid);
grant all on tmp_ids to authenticated;

insert into tmp_ids
select 'contract', offer_contract(
  '00000000-0000-0000-0000-00000000e0e0', 'trainer@plans.test',
  'freelancer', 'per_course', 40, current_date, null
);

-- Vor Annahme darf Trainer nicht im Plan eingeteilt werden
select throws_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000f0f0',
       current_date,
       '[{"weekday":1,"start_time":"18:00","end_time":"19:00","course_type_id":"00000000-0000-0000-0000-000000001111","trainer_id":"00000000-0000-0000-0000-0000000002b1"}]'::jsonb
     ) $$,
  'P0001', 'trainer_without_active_contract',
  'Trainer:in ohne angenommenen Vertrag kann keinem Slot zugewiesen werden'
);

-- Trainer:in nimmt Vertrag an
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000002b1');
select accept_contract((select id from tmp_ids where k = 'contract'));

-- Company-Admin sieht Trainer:in in get_company_active_trainers
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');

select is(
  (select full_name from get_company_active_trainers('00000000-0000-0000-0000-00000000e0e0')),
  'Sabine Kurs',
  'get_company_active_trainers liefert Trainer:in mit aktivem Vertrag'
);

-- Kurstyp einer fremden Company wird abgelehnt
select throws_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000f0f0',
       current_date,
       '[{"weekday":1,"start_time":"18:00","end_time":"19:00","course_type_id":"00000000-0000-0000-0000-000000002222","trainer_id":"00000000-0000-0000-0000-0000000002b1"}]'::jsonb
     ) $$,
  'P0001', 'course_type_company_mismatch',
  'Fremder Kurstyp wird bei publish_course_plan abgelehnt'
);

-- Erster Plan wird erfolgreich veröffentlicht
insert into tmp_ids
select 'plan1', publish_course_plan(
  '00000000-0000-0000-0000-00000000f0f0',
  date '2026-12-01',
  '[{"weekday":1,"start_time":"18:00","end_time":"19:00","course_type_id":"00000000-0000-0000-0000-000000001111","trainer_id":"00000000-0000-0000-0000-0000000002b1"}]'::jsonb
);

select is(
  (select status from course_plans where id = (select id from tmp_ids where k = 'plan1')),
  'active',
  'Erster Kursplan wird als active angelegt'
);

select is(
  (select count(*) from get_plan_slots_detailed((select id from tmp_ids where k = 'plan1'))),
  1::bigint,
  'get_plan_slots_detailed liefert die Slots des Plans'
);

-- Zweite Version archiviert den alten Plan automatisch zum Vortag
insert into tmp_ids
select 'plan2', publish_course_plan(
  '00000000-0000-0000-0000-00000000f0f0',
  date '2027-01-01',
  '[
    {"weekday":1,"start_time":"18:00","end_time":"19:00","course_type_id":"00000000-0000-0000-0000-000000001111","trainer_id":"00000000-0000-0000-0000-0000000002b1"},
    {"weekday":3,"start_time":"07:30","end_time":"08:30","course_type_id":"00000000-0000-0000-0000-000000001111","trainer_id":"00000000-0000-0000-0000-0000000002b1"}
  ]'::jsonb
);

select is(
  (select status from course_plans where id = (select id from tmp_ids where k = 'plan1')),
  'archived',
  'Vorheriger Kursplan wird automatisch archiviert'
);

select is(
  (select valid_to from course_plans where id = (select id from tmp_ids where k = 'plan1')),
  date '2026-12-31',
  'Archivierter Plan erhält valid_to = Vortag der neuen Version'
);

select is(
  (select count(*) from course_plan_slots where course_plan_id = (select id from tmp_ids where k = 'plan2')),
  2::bigint,
  'Neue Version enthält beide Slots'
);

-- Trainer:in mit aktivem Vertrag darf Slots lesend abrufen, aber keinen Plan veröffentlichen
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000002b1');

select is(
  (select count(*) from get_plan_slots_detailed((select id from tmp_ids where k = 'plan2'))),
  2::bigint,
  'Trainer:in mit aktivem Vertrag sieht Slots des Studios'
);

select throws_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000f0f0',
       date '2027-02-01',
       '[{"weekday":1,"start_time":"18:00","end_time":"19:00","course_type_id":"00000000-0000-0000-0000-000000001111","trainer_id":"00000000-0000-0000-0000-0000000002b1"}]'::jsonb
     ) $$,
  'P0001', 'not_authorized',
  'Trainer:in darf keinen Kursplan veröffentlichen'
);

-- Fremde Person darf weder Slots noch Trainer abrufen
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000002c1');

select throws_ok(
  format('select * from get_plan_slots_detailed(%L)', (select id from tmp_ids where k = 'plan2')),
  'P0001', 'not_authorized',
  'Fremde Person darf fremde Plan-Slots nicht lesen'
);

select throws_ok(
  $$ select * from get_company_active_trainers('00000000-0000-0000-0000-00000000e0e0') $$,
  'P0001', 'not_authorized',
  'Fremde Person darf get_company_active_trainers nicht aufrufen'
);

select * from finish();
rollback;
