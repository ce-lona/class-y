-- pgTAP-Test für Pending-Vertretungen (`substitute_assignments`, Migration 20261125190000).
begin;
select plan(10);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000006a1', 'admin@sub.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006b1', 'sabine@sub.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006b2', 'marco@sub.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006c1', 'outsider@sub.test', 'authenticated', 'authenticated');

update profiles set full_name = 'Sabine Original' where id = '00000000-0000-0000-0000-0000000006b1';
update profiles set full_name = 'Marco Vertretung' where id = '00000000-0000-0000-0000-0000000006b2';

insert into companies (id, name)
values ('00000000-0000-0000-0000-00000000a601', 'Sub Company');

insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-00000000a601');

insert into studios (id, company_id, name)
values ('00000000-0000-0000-0000-00000000b601', '00000000-0000-0000-0000-00000000a601', 'Studio Sub');

insert into course_types (id, company_id, name, default_duration_min)
values ('00000000-0000-0000-0000-00000000c601', '00000000-0000-0000-0000-00000000a601', 'Pilates', 60);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create temp table tmp_ids (k text primary key, id uuid);
grant all on tmp_ids to authenticated;

-- Aktive Verträge für Sabine & Marco
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
insert into tmp_ids select 'c1', offer_contract('00000000-0000-0000-0000-00000000a601', 'sabine@sub.test', 'freelancer', 'per_course', 45, current_date - 10, null);
insert into tmp_ids select 'c2', offer_contract('00000000-0000-0000-0000-00000000a601', 'marco@sub.test', 'freelancer', 'per_minute', 0.80, current_date - 10, null);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
select accept_contract((select id from tmp_ids where k = 'c1'));

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
select accept_contract((select id from tmp_ids where k = 'c2'));

-- Plan mit Slot für Sabine am heutigen Wochentag veröffentlichen
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
insert into tmp_ids
select 'plan', publish_course_plan(
  '00000000-0000-0000-0000-00000000b601',
  current_date - 7,
  jsonb_build_array(
    jsonb_build_object(
      'weekday', extract(isodow from current_date)::int,
      'start_time', '18:00',
      'end_time', '19:00',
      'course_type_id', '00000000-0000-0000-0000-00000000c601',
      'trainer_id', '00000000-0000-0000-0000-0000000006b1'
    )
  )
);

insert into tmp_ids
select 'slot', id from course_plan_slots where course_plan_id = (select id from tmp_ids where k = 'plan') limit 1;

-- 1. Sabine sieht Kollegen über get_company_colleagues
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
select is(
  (select count(*)::int from get_company_colleagues('00000000-0000-0000-0000-00000000a601')),
  2,
  'Trainer:in sieht aktive Kolleg:innen der Company'
);

-- 2. Sabine fragt Marco als Vertretung an -> startet zwingend als pending
insert into tmp_ids
select 'sub1', request_substitution(
  (select id from tmp_ids where k = 'slot'),
  current_date,
  '00000000-0000-0000-0000-0000000006b2',
  'Bitte übernehmen!'
);

select is(
  (select status from substitute_assignments where id = (select id from tmp_ids where k = 'sub1')),
  'pending',
  'Vertretung startet zwingend im Status pending'
);

-- 3. Sabine darf ihre eigene Anfrage NICHT für Marco annehmen
select throws_ok(
  $$ select respond_substitution((select id from tmp_ids where k = 'sub1'), 'accepted') $$,
  'P0001', 'substitution_not_found_or_not_pending',
  'Original-Trainer:in darf Anfrage nicht selbst annehmen'
);

-- 4. Monitoring zeigt pending_substitute_name solange pending
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
select is(
  (select pending_substitute_name from get_company_monitoring('00000000-0000-0000-0000-00000000a601', current_date, current_date, null) limit 1),
  'Marco Vertretung',
  'Monitoring zeigt ausstehende Vertretungsanfrage'
);

-- 5. Marco lehnt zunächst ab -> Status declined, danach neue Anfrage möglich
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
select lives_ok(
  $$ select respond_substitution((select id from tmp_ids where k = 'sub1'), 'declined') $$,
  'Angefragte Vertretung kann ablehnen'
);

select is(
  (select status from substitute_assignments where id = (select id from tmp_ids where k = 'sub1')),
  'declined',
  'Status ist nach Ablehnung declined'
);

-- 6. Sabine fragt erneut an und Marco nimmt an -> Status accepted
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
insert into tmp_ids
select 'sub2', request_substitution(
  (select id from tmp_ids where k = 'slot'),
  current_date,
  '00000000-0000-0000-0000-0000000006b2',
  null
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
select lives_ok(
  $$ select respond_substitution((select id from tmp_ids where k = 'sub2'), 'accepted') $$,
  'Angefragte Vertretung kann annehmen'
);

-- 7. Monitoring ordnet den ungeplanten Slot jetzt Marco als Vertretung zu
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
select is(
  (select trainer_name from get_company_monitoring('00000000-0000-0000-0000-00000000a601', current_date, current_date, null) limit 1),
  'Marco Vertretung',
  'Nach Annahme zeigt Monitoring die Vertretung als geplanten Trainer'
);

select is(
  (select is_substitution from get_company_monitoring('00000000-0000-0000-0000-00000000a601', current_date, current_date, null) limit 1),
  true,
  'Nach Annahme ist is_substitution = true im Monitoring'
);

-- 8. Außenstehender sieht keine substitute_assignments
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006c1');
select is(
  (select count(*)::int from substitute_assignments),
  0,
  'Außenstehender sieht keine Vertretungsanfragen'
);

select * from finish();
rollback;
