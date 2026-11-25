-- pgTAP-Test für den monatlichen Abrechnungs-Export (Migration 20261125210000_billing_export),
-- ausführbar mit `supabase test db`. Läuft in einer Transaktion und wird zurückgerollt.
-- Abrechnungsmonat ist bewusst ein vollständig vergangener Monat (vor zwei Monaten),
-- damit der Test unabhängig vom aktuellen Tag stabil ist.
begin;
select plan(16);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000005a1', 'admin@billing.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005a2', 'coord@billing.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005b1', 'sabine@billing.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005b2', 'marco@billing.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005c1', 'outsider@billing.test', 'authenticated', 'authenticated');

update profiles set full_name = 'Sabine M.' where id = '00000000-0000-0000-0000-0000000005b1';
update profiles set full_name = 'Marco M.' where id = '00000000-0000-0000-0000-0000000005b2';

insert into companies (id, name) values ('00000000-0000-0000-0000-00000000a090', 'Billing GmbH');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000a090');
insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-00000000a191', '00000000-0000-0000-0000-00000000a090', 'Studio Nord'),
  ('00000000-0000-0000-0000-00000000a292', '00000000-0000-0000-0000-00000000a090', 'Studio Süd');
insert into studio_coordinators (user_id, studio_id)
values ('00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-00000000a191');
insert into course_types (id, company_id, name, default_duration_min)
values ('00000000-0000-0000-0000-00000000a393', '00000000-0000-0000-0000-00000000a090', 'Pilates', 60);

create temp table tmp_bill (k text primary key, id uuid, d date);
grant all on tmp_bill to authenticated;

-- Abrechnungsmonat M = erster Tag des vorletzten Monats
insert into tmp_bill (k, d) values ('m', date_trunc('month', current_date - interval '2 months')::date);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.m() returns date language sql stable as $$
  select d from tmp_bill where k = 'm'
$$;

-- Verträge: Sabine 50 €/Kurs, Marco 40 €/Std.
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
insert into tmp_bill (k, id)
select 'c1', offer_contract('00000000-0000-0000-0000-00000000a090', 'sabine@billing.test', 'freelancer', 'per_course', 50, pg_temp.m() - 30, null);
insert into tmp_bill (k, id)
select 'c2', offer_contract('00000000-0000-0000-0000-00000000a090', 'marco@billing.test', 'freelancer', 'hourly', 40, pg_temp.m() - 30, null);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005b1');
select accept_contract((select id from tmp_bill where k = 'c1'));

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005b2');
select accept_contract((select id from tmp_bill where k = 'c2'));

-- Plan Studio Nord ab M: ein Slot am Wochentag von M (Sabine, 10–11 Uhr)
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
insert into tmp_bill (k, id)
select 'plan', publish_course_plan(
  '00000000-0000-0000-0000-00000000a191',
  pg_temp.m(),
  jsonb_build_array(
    jsonb_build_object(
      'weekday', extract(isodow from pg_temp.m())::int,
      'start_time', '10:00',
      'end_time', '11:00',
      'course_type_id', '00000000-0000-0000-0000-00000000a393',
      'trainer_id', '00000000-0000-0000-0000-0000000005b1'
    )
  )
);

reset role;
insert into tmp_bill (k, id)
select 'slot', id from course_plan_slots where course_plan_id = (select id from tmp_bill where k = 'plan') limit 1;

-- Erfasste Kurse im Monat M (direkt als postgres, um Erfassungsfristen zu umgehen):
--   M      Sabine gibt ihren Kurs           -> given, 50 €
--   M + 7  Marco vertritt Sabine (60 Min.)  -> substitution, 40 €
--   M + 14 Sabine sagt ab                   -> cancelled, kein Honorar
--   M + 2  Marco Ad-hoc in Studio Süd 90 Min. -> given, 60 €
-- Alle übrigen Slot-Termine im Monat      -> not_logged
insert into course_sessions (studio_id, course_plan_slot_id, course_type_id, date, start_time, end_time, trainer_id, is_substitution, status)
values
  ('00000000-0000-0000-0000-00000000a191', (select id from tmp_bill where k = 'slot'), null, pg_temp.m(), '10:00', '11:00', '00000000-0000-0000-0000-0000000005b1', false, 'completed'),
  ('00000000-0000-0000-0000-00000000a191', (select id from tmp_bill where k = 'slot'), null, pg_temp.m() + 7, '10:00', '11:00', '00000000-0000-0000-0000-0000000005b2', true, 'completed'),
  ('00000000-0000-0000-0000-00000000a191', (select id from tmp_bill where k = 'slot'), null, pg_temp.m() + 14, '10:00', '11:00', '00000000-0000-0000-0000-0000000005b1', false, 'cancelled'),
  ('00000000-0000-0000-0000-00000000a292', null, '00000000-0000-0000-0000-00000000a393', pg_temp.m() + 2, '15:00', '16:30', '00000000-0000-0000-0000-0000000005b2', false, 'completed');

-- Anzahl Slot-Termine im Monat M (4 oder 5)
insert into tmp_bill (k, d)
select 'occ', (pg_temp.m() + (count(*)::int))
from generate_series(pg_temp.m(), (pg_temp.m() + interval '1 month' - interval '1 day')::date, interval '7 days');

-- ── Company-Admin ──────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');

create temp table tmp_admin as
select * from get_billing_export('00000000-0000-0000-0000-00000000a090', pg_temp.m() + 10, 'company', null, null);

select is(
  (select count(*) from tmp_admin where category = 'given'),
  2::bigint,
  'Admin: zwei regulär gegebene Kurse (Plan-Slot + Ad-hoc)'
);

select is(
  (select sum(fee) from tmp_admin),
  150.00::numeric,
  'Admin: Honorarsumme 50 € (Kurs) + 40 € (1 Std.) + 60 € (1,5 Std.)'
);

select is(
  (select substituted_trainer_name || ' / ' || fee::text from tmp_admin where category = 'substitution'),
  'Sabine M. / 40.00',
  'Admin: Vertretung nennt vertretene Trainer:in und berechnet Marcos Stundensatz'
);

select is(
  (select count(*) || ' / ' || coalesce(sum(fee)::text, 'null') from tmp_admin where category = 'cancelled'),
  '1 / null',
  'Admin: ausgefallener Kurs ohne Honorar'
);

select is(
  (select count(*)::int from tmp_admin where category = 'not_logged'),
  (select d - pg_temp.m() from tmp_bill where k = 'occ') - 3,
  'Admin: übrige vergangene Slot-Termine erscheinen als nicht erfasst'
);

select is(
  (select count(*) from tmp_admin where course_date not between pg_temp.m() and (pg_temp.m() + interval '1 month' - interval '1 day')::date),
  0::bigint,
  'Admin: nur Kurse des gewählten Monats'
);

-- ── Koordinator:in (nur Studio Nord) ──────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005a2');

select is(
  (select count(*) from get_billing_export('00000000-0000-0000-0000-00000000a090', pg_temp.m(), 'company', null, null)
   where studio_name = 'Studio Süd'),
  0::bigint,
  'Koordinator:in sieht keine Kurse fremder Studios'
);

select ok(
  (select count(*) > 0 from get_billing_export('00000000-0000-0000-0000-00000000a090', pg_temp.m(), 'company', null, null)
   where studio_name = 'Studio Nord'),
  'Koordinator:in sieht Kurse des eigenen Studios'
);

select throws_ok(
  $$ select * from get_billing_export('00000000-0000-0000-0000-00000000a090', current_date, 'company', '00000000-0000-0000-0000-00000000a292', null) $$,
  'P0001', 'not_authorized',
  'Koordinator:in darf fremdes Studio nicht explizit exportieren'
);

-- ── Trainer:in ────────────────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005b2');

select is(
  (select count(*) || ' / ' || sum(fee)::text
   from get_billing_export('00000000-0000-0000-0000-00000000a090', pg_temp.m(), 'mine', null, null)),
  '2 / 100.00',
  'Trainer:in exportiert nur eigene Kurse (Vertretung + Ad-hoc)'
);

select throws_ok(
  $$ select * from get_billing_export('00000000-0000-0000-0000-00000000a090', current_date, 'mine', null, '00000000-0000-0000-0000-0000000005b1') $$,
  'P0001', 'not_authorized',
  'Trainer:in darf keine fremden Kurse exportieren'
);

select throws_ok(
  $$ select * from get_billing_export('00000000-0000-0000-0000-00000000a090', current_date, 'company', null, null) $$,
  'P0001', 'not_authorized',
  'Trainer:in darf keinen Company-Export abrufen'
);

select is(
  (select count(*) from get_my_billing_companies()),
  1::bigint,
  'Trainer:in sieht ihre Company in der Export-Auswahl'
);

select throws_ok(
  $$ select * from billing_export_rows('00000000-0000-0000-0000-00000000a090', current_date, current_date, '{}', null) $$,
  '42501', 'permission denied for function billing_export_rows',
  'Interne Zeilen-Funktion ist nicht direkt aufrufbar'
);

-- ── Außenstehende ─────────────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000005c1');

select throws_ok(
  $$ select * from get_billing_export('00000000-0000-0000-0000-00000000a090', current_date, 'mine', null, null) $$,
  'P0001', 'not_authorized',
  'Außenstehende Person ohne Vertrag darf nicht exportieren'
);

select throws_ok(
  $$ select * from get_billing_export('00000000-0000-0000-0000-00000000a090', current_date, 'company', null, null) $$,
  'P0001', 'not_authorized',
  'Außenstehende Person darf keinen Company-Export abrufen'
);

select * from finish();
rollback;
