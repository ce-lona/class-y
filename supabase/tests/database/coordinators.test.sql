-- pgTAP-Test für Kurskoordinatoren (`studio_coordinators`) & Studio-bezogene Verträge (`contract_studios`)
-- (Migration 20261125200000), ausführbar mit `supabase test db`.
begin;
select plan(13);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000007a1', 'admin@coord.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007a2', 'coord@coord.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007b1', 'trainer-a@coord.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007b2', 'trainer-b@coord.test', 'authenticated', 'authenticated');

insert into companies (id, name)
values ('00000000-0000-0000-0000-00000000a701', 'Coord Company');

insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-00000000a701');

insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-00000000b701', '00000000-0000-0000-0000-00000000a701', 'Studio A'),
  ('00000000-0000-0000-0000-00000000b702', '00000000-0000-0000-0000-00000000a701', 'Studio B');

insert into course_types (id, company_id, name, default_duration_min)
values ('00000000-0000-0000-0000-00000000c701', '00000000-0000-0000-0000-00000000a701', 'Cycling', 45);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create temp table tmp_ids (k text primary key, id uuid);
grant all on tmp_ids to authenticated;

-- Company-Admin weist Kurskoordinator exklusiv Studio A zu
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');

select lives_ok(
  $$ select set_studio_coordinator_studios(
       '00000000-0000-0000-0000-00000000a701',
       'coord@coord.test',
       array['00000000-0000-0000-0000-00000000b701'::uuid]
     ) $$,
  'Company-Admin kann Kurskoordinator exklusiv für Studio A ermächtigen'
);

-- Company-Admin bietet Trainer A einen Vertrag für Studio A und Trainer B einen Vertrag für Studio B an
insert into tmp_ids select 'ca', offer_contract(
  '00000000-0000-0000-0000-00000000a701', 'trainer-a@coord.test',
  'freelancer', 'per_course', 40, current_date - 5, null,
  array['00000000-0000-0000-0000-00000000b701'::uuid]
);
insert into tmp_ids select 'cb', offer_contract(
  '00000000-0000-0000-0000-00000000a701', 'trainer-b@coord.test',
  'freelancer', 'per_course', 55, current_date - 5, null,
  array['00000000-0000-0000-0000-00000000b702'::uuid]
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
select accept_contract((select id from tmp_ids where k = 'ca'));

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b2');
select accept_contract((select id from tmp_ids where k = 'cb'));

-- Company-Admin veröffentlicht auch einen Plan in Studio B (für Monitoring-Isolationstest)
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select publish_course_plan(
  '00000000-0000-0000-0000-00000000b702',
  current_date - 2,
  jsonb_build_array(jsonb_build_object(
    'weekday', extract(isodow from current_date)::int,
    'start_time', '10:00',
    'end_time', '10:45',
    'course_type_id', '00000000-0000-0000-0000-00000000c701',
    'trainer_id', '00000000-0000-0000-0000-0000000007b2'
  ))
);

-- Jetzt als Kurskoordinator (nur Studio A) einloggen
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007a2');

-- 2. get_my_managed_companies liefert role = coordinator
select is(
  (select role from get_my_managed_companies() limit 1),
  'coordinator',
  'Kurskoordinator erhält role = coordinator in get_my_managed_companies'
);

-- 3. Koordinator sieht per RLS ausschließlich Studio A
select is(
  (select count(*)::int from studios where company_id = '00000000-0000-0000-0000-00000000a701'),
  1,
  'Kurskoordinator sieht ausschließlich sein zugewiesenes Studio A'
);

-- 4. Koordinator kann Kursplan für Studio A veröffentlichen
select lives_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000b701',
       current_date - 2,
       jsonb_build_array(jsonb_build_object(
         'weekday', extract(isodow from current_date)::int,
         'start_time', '18:00',
         'end_time', '18:45',
         'course_type_id', '00000000-0000-0000-0000-00000000c701',
         'trainer_id', '00000000-0000-0000-0000-0000000007b1'
       ))
     ) $$,
  'Kurskoordinator darf Kursplan für sein Studio A veröffentlichen'
);

-- 5. Koordinator darf KEINEN Kursplan für Studio B veröffentlichen
select throws_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000b702',
       current_date,
       jsonb_build_array(jsonb_build_object(
         'weekday', 1,
         'start_time', '18:00',
         'end_time', '18:45',
         'course_type_id', '00000000-0000-0000-0000-00000000c701',
         'trainer_id', '00000000-0000-0000-0000-0000000007b2'
       ))
     ) $$,
  'P0001', 'not_authorized',
  'Kurskoordinator darf keinen Kursplan für fremdes Studio B veröffentlichen'
);

-- 6. Monitoring liefert für den Koordinator NUR Studio A (kein Studio B!)
select is(
  (select count(*)::int from get_company_monitoring('00000000-0000-0000-0000-00000000a701', current_date, current_date, null) where studio_id = '00000000-0000-0000-0000-00000000b702'),
  0,
  'Monitoring filtert fremdes Studio B für den Kurskoordinator strikt heraus'
);

-- 7. Explizite Monitoring-Abfrage auf Studio B wird abgelehnt
select throws_ok(
  $$ select * from get_company_monitoring('00000000-0000-0000-0000-00000000a701', current_date, current_date, '00000000-0000-0000-0000-00000000b702') $$,
  'P0001', 'not_authorized',
  'Explizite Monitoring-Abfrage für fremdes Studio B schlägt fehl'
);

-- 8. Koordinator sieht nur Verträge der Trainer seines Studios (Trainer A, nicht Trainer B!)
select is(
  (select array_agg(trainer_email) from get_company_contracts('00000000-0000-0000-0000-00000000a701')),
  array['trainer-a@coord.test']::text[],
  'Kurskoordinator sieht ausschließlich Verträge der Trainer seines Studios A'
);

-- 9. Koordinator kann Vertrag für Studio A anbieten
select lives_ok(
  $$ select offer_contract(
       '00000000-0000-0000-0000-00000000a701', 'trainer-a@coord.test',
       'freelancer', 'per_minute', 0.65, current_date, null,
       array['00000000-0000-0000-0000-00000000b701'::uuid]
     ) $$,
  'Kurskoordinator darf Vertrag für sein Studio A anbieten'
);

-- 10. Koordinator darf KEINEN Vertrag für Studio B anbieten
select throws_ok(
  $$ select offer_contract(
       '00000000-0000-0000-0000-00000000a701', 'trainer-b@coord.test',
       'freelancer', 'per_course', 45, current_date, null,
       array['00000000-0000-0000-0000-00000000b702'::uuid]
     ) $$,
  'P0001', 'not_authorized',
  'Kurskoordinator darf keinen Vertrag für fremdes Studio B anbieten'
);

-- 11. Koordinator darf keine weiteren Koordinatoren verwalten
select throws_ok(
  $$ select set_studio_coordinator_studios(
       '00000000-0000-0000-0000-00000000a701',
       'trainer-a@coord.test',
       array['00000000-0000-0000-0000-00000000b701'::uuid]
     ) $$,
  'P0001', 'not_authorized',
  'Kurskoordinator darf keine anderen Kurskoordinatoren ernennen'
);

-- 12. Koordinator darf fremde Verträge nicht direkt mit seinem Studio verknüpfen
select throws_ok(
  $$ insert into contract_studios (contract_id, studio_id)
     values ((select id from tmp_ids where k = 'cb'), '00000000-0000-0000-0000-00000000b701') $$,
  '42501', null,
  'Kurskoordinator kann Vertrag von Trainer B nicht direkt Studio A zuordnen'
);

-- 13. Honorar von Trainer B bleibt für den Koordinator unsichtbar
select is(
  (select count(*)::int from contracts where id = (select id from tmp_ids where k = 'cb')),
  0,
  'Vertrag von Trainer B bleibt für den Kurskoordinator unsichtbar'
);

select * from finish();
rollback;
