-- pgTAP-Test für Studio-Monitoring (Migration 20261125110000),
-- ausführbar mit `supabase test db`. Läuft in einer Transaktion und wird zurückgerollt.
begin;
select plan(8);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000004a1', 'admin@monitoring.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000004b1', 'sabine@monitoring.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000004b2', 'marco@monitoring.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000004c1', 'outsider@monitoring.test', 'authenticated', 'authenticated');

update profiles set full_name = 'Sabine M.' where id = '00000000-0000-0000-0000-0000000004b1';
update profiles set full_name = 'Marco M.' where id = '00000000-0000-0000-0000-0000000004b2';

insert into companies (id, name) values ('00000000-0000-0000-0000-000000009090', 'Monitoring GmbH');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-000000009090');
insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-000000009191', '00000000-0000-0000-0000-000000009090', 'Studio Nord'),
  ('00000000-0000-0000-0000-000000009292', '00000000-0000-0000-0000-000000009090', 'Studio Süd');
insert into course_types (id, company_id, name, default_duration_min)
values ('00000000-0000-0000-0000-000000009393', '00000000-0000-0000-0000-000000009090', 'Pilates', 60);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Verträge erstellen & annehmen (gültig ab vor 30 Tagen)
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');

create temp table tmp_mon (k text primary key, id uuid);
grant all on tmp_mon to authenticated;

insert into tmp_mon
select 'c1', offer_contract('00000000-0000-0000-0000-000000009090', 'sabine@monitoring.test', 'freelancer', 'per_course', 50, current_date - 30, null);
insert into tmp_mon
select 'c2', offer_contract('00000000-0000-0000-0000-000000009090', 'marco@monitoring.test', 'freelancer', 'hourly', 40, current_date - 30, null);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000004b1');
select accept_contract((select id from tmp_mon where k = 'c1'));

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000004b2');
select accept_contract((select id from tmp_mon where k = 'c2'));

-- Plan für Studio Nord ab (current_date - 14) mit Slot am gestrigen Wochentag
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');

insert into tmp_mon
select 'plan', publish_course_plan(
  '00000000-0000-0000-0000-000000009191',
  current_date - 14,
  jsonb_build_array(
    jsonb_build_object(
      'weekday', extract(isodow from (current_date - 1))::int,
      'start_time', '10:00',
      'end_time', '11:00',
      'course_type_id', '00000000-0000-0000-0000-000000009393',
      'trainer_id', '00000000-0000-0000-0000-0000000004b1'
    )
  )
);

insert into tmp_mon
select 'slot', id from course_plan_slots where course_plan_id = (select id from tmp_mon where k = 'plan') limit 1;

-- 1. Ungepflegter gestriger Slot erscheint als 'overdue' mit Vertrags-Satz
select is(
  (select status from get_company_monitoring('00000000-0000-0000-0000-000000009090', current_date - 1, current_date - 1, null)),
  'overdue',
  'Nicht erfasster gestriger Plan-Slot wird als overdue gemeldet'
);

select is(
  (select rate_amount from get_company_monitoring('00000000-0000-0000-0000-000000009090', current_date - 1, current_date - 1, null)),
  50.00::numeric,
  'Monitoring liefert den zugehörigen Vertragssatz mit'
);

-- 2. Zukünftiger Slot (+6 Tage = gleicher Wochentag wie gestern) erscheint als 'planned'
select is(
  (select status from get_company_monitoring('00000000-0000-0000-0000-000000009090', current_date + 6, current_date + 6, null)),
  'planned',
  'Zukünftiger Plan-Slot wird als planned gemeldet'
);

-- 3. Marco vertritt den gestrigen Slot spontan + loggt zusätzlich einen Ad-hoc-Kurs in Studio Süd
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000004b2');

insert into course_sessions (studio_id, course_plan_slot_id, date, start_time, end_time, trainer_id, status)
values (
  '00000000-0000-0000-0000-000000009191',
  (select id from tmp_mon where k = 'slot'),
  current_date - 1,
  '10:00',
  '11:00',
  '00000000-0000-0000-0000-0000000004b2',
  'completed'
);

insert into course_sessions (studio_id, course_plan_slot_id, course_type_id, date, start_time, end_time, trainer_id, status)
values (
  '00000000-0000-0000-0000-000000009292',
  null,
  '00000000-0000-0000-0000-000000009393',
  current_date - 1,
  '15:00',
  '16:30',
  '00000000-0000-0000-0000-0000000004b2',
  'completed'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');

select is(
  (select count(*) from get_company_monitoring('00000000-0000-0000-0000-000000009090', current_date - 1, current_date - 1, null)),
  2::bigint,
  'Erfasste Vertretung ersetzt den overdue-Eintrag und Ad-hoc-Kurs kommt hinzu (gesamt 2)'
);

select is(
  (select scheduled_trainer_name from get_company_monitoring('00000000-0000-0000-0000-000000009090', current_date - 1, current_date - 1, '00000000-0000-0000-0000-000000009191')),
  'Sabine M.',
  'Studio-Filter liefert die Vertretung inkl. ursprünglich geplanter Trainer:in'
);

select is(
  (select is_ad_hoc from get_company_monitoring('00000000-0000-0000-0000-000000009090', current_date - 1, current_date - 1, '00000000-0000-0000-0000-000000009292')),
  true,
  'Studio-Filter für Studio Süd liefert den Ad-hoc-Kurs'
);

-- 4. Trainer:in & Außenstehende dürfen Company-Monitoring nicht abrufen
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000004b1');
select throws_ok(
  $$ select * from get_company_monitoring('00000000-0000-0000-0000-000000009090', current_date - 7, current_date, null) $$,
  'P0001', 'not_authorized',
  'Trainer:in darf Company-Monitoring nicht abrufen'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000004c1');
select throws_ok(
  $$ select * from get_company_monitoring('00000000-0000-0000-0000-000000009090', current_date - 7, current_date, null) $$,
  'P0001', 'not_authorized',
  'Außenstehende Person darf Company-Monitoring nicht abrufen'
);

select * from finish();
rollback;
