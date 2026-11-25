-- pgTAP-Test für per_minute-Vergütungsmodell und optionale Studio-Einschränkung bei Kurstypen
-- (Migration 20261125180000), ausführbar mit `supabase test db`.
begin;
select plan(8);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000005a1', 'admin@ctstudios.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005b1', 'trainer@ctstudios.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005c1', 'other@ctstudios.test', 'authenticated', 'authenticated');

insert into companies (id, name) values
  ('00000000-0000-0000-0000-00000000c101', 'CT Studios Company A'),
  ('00000000-0000-0000-0000-00000000c102', 'CT Studios Company B');

insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000c101');

insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000c101', 'Studio Nord'),
  ('00000000-0000-0000-0000-00000000d102', '00000000-0000-0000-0000-00000000c101', 'Studio Süd'),
  ('00000000-0000-0000-0000-00000000d201', '00000000-0000-0000-0000-00000000c102', 'Fremdes Studio');

insert into course_types (id, company_id, name, default_duration_min) values
  ('00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-00000000c101', 'Reformer Pilates', 50);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create temp table tmp_ids (k text primary key, id uuid);
grant all on tmp_ids to authenticated;

-- 1. Company-Admin kann Vertrag mit `per_minute` anbieten
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
insert into tmp_ids
select 'c1', offer_contract(
  '00000000-0000-0000-0000-00000000c101', 'trainer@ctstudios.test',
  'freelancer', 'per_minute', 0.55, current_date, null
);

select is(
  (select rate_model from contracts where id = (select id from tmp_ids where k = 'c1')),
  'per_minute',
  'Vertrag mit rate_model per_minute wird akzeptiert'
);

-- Trainer nimmt Vertrag an
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005b1');
select accept_contract((select id from tmp_ids where k = 'c1'));

-- 2. Company-Admin schränkt Kurstyp auf Studio Nord ein
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
select lives_ok(
  $$ select set_course_type_studios(
       '00000000-0000-0000-0000-00000000e101',
       array['00000000-0000-0000-0000-00000000d101'::uuid]
     ) $$,
  'Company-Admin kann Studio-Einschränkung für Kurstyp setzen'
);

-- 3. Studio einer fremden Company wird abgelehnt
select throws_ok(
  $$ select set_course_type_studios(
       '00000000-0000-0000-0000-00000000e101',
       array['00000000-0000-0000-0000-00000000d201'::uuid]
     ) $$,
  'P0001', 'course_type_studio_company_mismatch',
  'Studio einer fremden Company darf keinem Kurstyp zugeordnet werden'
);

-- 4. publish_course_plan lehnt eingeschränkten Kurstyp im nicht erlaubten Studio Süd ab
select throws_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000d102',
       current_date,
       '[{"weekday":1,"start_time":"18:00","end_time":"18:50","course_type_id":"00000000-0000-0000-0000-00000000e101","trainer_id":"00000000-0000-0000-0000-0000000005b1"}]'::jsonb
     ) $$,
  'P0001', 'course_type_studio_mismatch',
  'Eingeschränkter Kurstyp wird im nicht freigegebenen Studio abgelehnt'
);

-- 5. publish_course_plan erlaubt eingeschränkten Kurstyp im erlaubten Studio Nord
select lives_ok(
  $$ select publish_course_plan(
       '00000000-0000-0000-0000-00000000d101',
       current_date,
       '[{"weekday":1,"start_time":"18:00","end_time":"18:50","course_type_id":"00000000-0000-0000-0000-00000000e101","trainer_id":"00000000-0000-0000-0000-0000000005b1"}]'::jsonb
     ) $$,
  'Eingeschränkter Kurstyp wird im freigegebenen Studio akzeptiert'
);

-- 6. Trainer mit aktivem Vertrag kann course_type_studios lesen, aber nicht ändern
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005b1');
select is(
  (select count(*)::int from course_type_studios where course_type_id = '00000000-0000-0000-0000-00000000e101'),
  1,
  'Trainer:in mit aktivem Vertrag kann Studio-Zuordnung lesen'
);

select throws_ok(
  $$ select set_course_type_studios(
       '00000000-0000-0000-0000-00000000e101',
       array[]::uuid[]
     ) $$,
  'P0001', 'not_authorized',
  'Trainer:in darf Studio-Zuordnung nicht ändern'
);

-- 7. Fremder Nutzer sieht keine course_type_studios
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005c1');
select is(
  (select count(*)::int from course_type_studios where course_type_id = '00000000-0000-0000-0000-00000000e101'),
  0,
  'Fremder Nutzer sieht keine course_type_studios'
);

select * from finish();
rollback;
