-- pgTAP-Test für Gutschriften, Stornogutschriften und Tätigkeitsnachweise
-- (Migration 20261126120000_credit_notes). Läuft in einer Transaktion und wird zurückgerollt.
-- Abrechnungsmonat ist der vorletzte Monat, damit der Test unabhängig vom Tag stabil ist.
begin;
select plan(31);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000006a1', 'admin@credit.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006a2', 'coord@credit.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006b1', 'sabine@credit.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006b2', 'lena@credit.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006b3', 'marco@credit.test', 'authenticated', 'authenticated');

insert into companies (id, name, street, house_number, postal_code, city)
values ('00000000-0000-0000-0000-00000000b090', 'Credit GmbH', 'Musterstraße', '12', '70173', 'Stuttgart');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-00000000b090');
insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-00000000b191', '00000000-0000-0000-0000-00000000b090', 'Studio Nord'),
  ('00000000-0000-0000-0000-00000000b292', '00000000-0000-0000-0000-00000000b090', 'Studio Süd');
insert into studio_coordinators (user_id, studio_id)
values ('00000000-0000-0000-0000-0000000006a2', '00000000-0000-0000-0000-00000000b191');
insert into course_types (id, company_id, name, default_duration_min)
values ('00000000-0000-0000-0000-00000000b393', '00000000-0000-0000-0000-00000000b090', 'Pilates', 60);

create temp table tmp_cn (k text primary key, id uuid, d date, j jsonb);
grant all on tmp_cn to authenticated;
insert into tmp_cn (k, d) values ('m', date_trunc('month', current_date - interval '2 months')::date);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.m() returns date language sql stable as $$
  select d from tmp_cn where k = 'm'
$$;

create function pg_temp.id(key text) returns uuid language sql stable as $$
  select id from tmp_cn where k = key
$$;

-- Verträge: Sabine 50 €/Kurs (regelbesteuert), Lena 40 €/Kurs (Kleinunternehmerin),
-- Marco Minijob 15 €/Std.
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
insert into tmp_cn (k, id) select 'c_sabine', offer_contract('00000000-0000-0000-0000-00000000b090', 'sabine@credit.test', 'freelancer', 'per_course', 50, pg_temp.m() - 30, null);
insert into tmp_cn (k, id) select 'c_lena', offer_contract('00000000-0000-0000-0000-00000000b090', 'lena@credit.test', 'freelancer', 'per_course', 40, pg_temp.m() - 30, null);
insert into tmp_cn (k, id) select 'c_marco', offer_contract('00000000-0000-0000-0000-00000000b090', 'marco@credit.test', 'minijob', 'hourly', 15, pg_temp.m() - 30, null);

-- ── Vertragsannahme mit Stammdaten ─────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');

select throws_ok(
  $$ select accept_contract_with_master_data(pg_temp.id('c_sabine'), 'Sabine Muster', 'Lindenweg', '4', '70190', 'Stuttgart', 'DE02120300000000202051', '99/123/45678', null, false, false) $$,
  'consent_missing',
  'Freiberuflerin kann ohne Zustimmung zum Gutschriftverfahren nicht annehmen'
);

select throws_ok(
  $$ select accept_contract_with_master_data(pg_temp.id('c_sabine'), 'Sabine Muster', 'Lindenweg', '4', '70190', 'Stuttgart', 'DE00120300000000202051', '99/123/45678', null, false, true) $$,
  'invalid_iban',
  'Ungültige IBAN wird abgelehnt'
);

select throws_ok(
  $$ select accept_contract_with_master_data(pg_temp.id('c_sabine'), 'Sabine Muster', 'Lindenweg', '4', '70190', 'Stuttgart', 'DE02120300000000202051', '', '', false, true) $$,
  'tax_number_missing',
  'Freiberuflerin braucht Steuernummer oder USt-IdNr.'
);

select lives_ok(
  $$ select accept_contract_with_master_data(pg_temp.id('c_sabine'), 'Sabine Muster', 'Lindenweg', '4', '70190', 'Stuttgart', 'DE02 1203 0000 0000 2020 51', '99/123/45678', null, false, true) $$,
  'Freiberuflerin nimmt mit vollständigen Stammdaten an'
);

select is(
  (select status || ' / ' || (credit_note_consent_at is not null)::text from get_my_contracts() where id = pg_temp.id('c_sabine')),
  'active / true',
  'Vertrag ist aktiv und die Zustimmung gespeichert'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
select accept_contract_with_master_data(pg_temp.id('c_lena'), 'Lena Probe', 'Gartenstraße', '21', '70180', 'Stuttgart', 'DE02120300000000202051', null, 'DE123456789', true, true);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b3');
select lives_ok(
  $$ select accept_contract_with_master_data(pg_temp.id('c_marco'), 'Marco Beispiel', 'Hauptstraße', '8', '70176', 'Stuttgart', 'DE02120300000000202051', null, null, null, false) $$,
  'Minijobber braucht weder Steuernummer noch Zustimmung'
);

-- ── Schutz sensibler Daten ─────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');

select is(
  (select count(*) from trainer_billing_details),
  0::bigint,
  'Company-Admin sieht IBAN/Steuernummern nicht direkt'
);

select throws_ok(
  $$ update contracts set confirmed_at = now() where id = pg_temp.id('c_sabine') $$,
  'contract_billing_fields_readonly',
  'Bestätigung nur über confirm_contract'
);

-- ── Kurse im Monat M ───────────────────────────────────────────
--   Sabine: 2 Kurse Nord (je 50 €)   Lena: 1 Kurs Süd (40 €)   Marco: 1 Kurs Nord 90 Min.
reset role;
insert into course_sessions (studio_id, course_type_id, date, start_time, end_time, trainer_id, status)
values
  ('00000000-0000-0000-0000-00000000b191', '00000000-0000-0000-0000-00000000b393', pg_temp.m() + 1, '10:00', '11:00', '00000000-0000-0000-0000-0000000006b1', 'completed'),
  ('00000000-0000-0000-0000-00000000b191', '00000000-0000-0000-0000-00000000b393', pg_temp.m() + 8, '10:00', '11:00', '00000000-0000-0000-0000-0000000006b1', 'completed'),
  ('00000000-0000-0000-0000-00000000b292', '00000000-0000-0000-0000-00000000b393', pg_temp.m() + 3, '18:00', '19:00', '00000000-0000-0000-0000-0000000006b2', 'completed'),
  ('00000000-0000-0000-0000-00000000b191', '00000000-0000-0000-0000-00000000b393', pg_temp.m() + 4, '17:00', '18:30', '00000000-0000-0000-0000-0000000006b3', 'completed');

-- ── Vorschau vor Bestätigung ───────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');

select ok(
  (select 'contract_not_confirmed' = any(skip_reasons) from get_billing_preview('00000000-0000-0000-0000-00000000b090', pg_temp.m(), null) where trainer_name = 'Sabine Muster'),
  'Unbestätigter Vertrag: Person wird übersprungen'
);

select lives_ok(
  $$ select confirm_contract(pg_temp.id('c_sabine')); select confirm_contract(pg_temp.id('c_lena')); $$,
  'Admin bestätigt Verträge'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a2');
select throws_ok(
  $$ select issue_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m(), null) $$,
  'not_authorized',
  'Koordinator:in darf bei Abrechnung je Company nicht erstellen'
);

-- ── Erste Erstellung ───────────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');

select throws_ok(
  $$ select issue_billing_documents('00000000-0000-0000-0000-00000000b090', current_date, null) $$,
  'month_not_finished',
  'Laufender Monat kann nicht abgerechnet werden'
);

select is(
  issue_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m(), null),
  '{"created": 2, "skipped": 0, "cancelled": 0, "statements": 0}'::jsonb,
  'Zwei Gutschriften, keine Nachweise (standardmäßig aus)'
);

select is(
  (select net || ' / ' || vat || ' / ' || gross from get_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m()) where trainer_name = 'Sabine Muster'),
  '100.00 / 19.00 / 119.00',
  'Sabine: 2 Kurse, 19 % MwSt'
);

select is(
  (select vat || ' / ' || gross from get_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m()) where trainer_name = 'Lena Probe'),
  '0.00 / 40.00',
  'Lena (Kleinunternehmerin): ohne MwSt'
);

select is(
  (select count(distinct number) from get_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m()) where number like 'GS-' || extract(year from current_date) || '-0000_'),
  2::bigint,
  'Fortlaufende Nummern aus dem Nummernkreis'
);

select is(
  issue_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m(), null),
  '{"created": 0, "skipped": 0, "cancelled": 0, "statements": 0}'::jsonb,
  'Erneuter Klick ohne Änderungen erstellt nichts'
);

-- ── Sichtbarkeit ───────────────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a2');
select is(
  (select coalesce(gross::text, 'verborgen') || ' / ' || can_view_amounts from get_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m())),
  'verborgen / false',
  'Koordinator:in (Nord) sieht Sabines Beleg nur mit Status, ohne Beträge; Lenas (Süd) gar nicht'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
select throws_ok(
  format('select * from get_billing_document(%L)', (select id from billing_documents where trainer_id = '00000000-0000-0000-0000-0000000006b1' limit 1)),
  'not_authorized',
  'Trainer:in sieht fremde Belege nicht'
);

-- ── Korrekturwunsch + Storno ───────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
insert into tmp_cn (k, id) select 'gs1', id from get_my_billing_documents();
select comment_billing_document(pg_temp.id('gs1'), 'Die Vertretung am 19. fehlt.');

select is(
  (select status from get_my_billing_documents() where id = pg_temp.id('gs1')),
  'correction_requested',
  'Korrekturwunsch setzt den Status'
);

reset role;
insert into course_sessions (studio_id, course_type_id, date, start_time, end_time, trainer_id, status)
values ('00000000-0000-0000-0000-00000000b292', '00000000-0000-0000-0000-00000000b393', pg_temp.m() + 18, '19:00', '20:00', '00000000-0000-0000-0000-0000000006b1', 'completed');

select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
select is(
  (select change || ' / ' || changed_lines from get_billing_preview('00000000-0000-0000-0000-00000000b090', pg_temp.m(), null) where trainer_name = 'Sabine Muster'),
  'changed / 1',
  'Vorschau zeigt Sabines Änderung'
);

select is(
  issue_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m(), null),
  '{"created": 1, "skipped": 0, "cancelled": 1, "statements": 0}'::jsonb,
  'Storno + neue Gutschrift nur für Sabine'
);

select is(
  (select string_agg(kind || ':' || status || ':' || gross, ', ' order by kind, status)
   from get_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m()) where trainer_name = 'Sabine Muster'),
  'cancellation:issued:-119.00, credit_note:cancelled:119.00, credit_note:open:178.50',
  'Original storniert, Storno negativ, neue Gutschrift über 3 Kurse'
);

reset role;
select is(
  (select snapshot -> 'replaces' ->> 'number' from billing_documents where trainer_id = '00000000-0000-0000-0000-0000000006b1' and kind = 'credit_note' and status = 'open'),
  (select number from billing_documents where id = pg_temp.id('gs1')),
  'Neue Gutschrift verweist auf das Original'
);

select throws_ok(
  format('update billing_documents set gross = 0 where id = %L', pg_temp.id('gs1')),
  'billing_document_immutable',
  'Belege sind unveränderlich'
);

-- ── Kommentar als erledigt markieren ───────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000006a2');
select resolve_billing_comment((select id from get_billing_comments('00000000-0000-0000-0000-00000000b090', pg_temp.m()) limit 1));
select is(
  (select count(*) from get_billing_comments('00000000-0000-0000-0000-00000000b090', pg_temp.m()) where resolved_at is null),
  0::bigint,
  'Koordinator:in markiert den Korrekturwunsch als erledigt'
);

-- ── Tätigkeitsnachweis ─────────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
insert into company_billing_settings (company_id, employee_statements)
values ('00000000-0000-0000-0000-00000000b090', true);
select confirm_contract(pg_temp.id('c_marco'));

select is(
  issue_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m(), null),
  '{"created": 0, "skipped": 0, "cancelled": 0, "statements": 1}'::jsonb,
  'Nachweis für Marco, sobald eingeschaltet'
);

select is(
  (select number is null and gross = 22.50 from get_billing_documents('00000000-0000-0000-0000-00000000b090', pg_temp.m()) where kind = 'statement'),
  true,
  'Nachweis ohne Nummer, 1,5 Std. à 15 €'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b3');
select lives_ok(
  $$ select comment_billing_document((select id from get_my_billing_documents() limit 1), 'Kurs ging bis 18:45.') $$,
  'Mitarbeiter kommentiert den Nachweis (keine Freigabe nötig)'
);

-- ── Fristablauf ────────────────────────────────────────────────
reset role;
select billing_run_daily(current_date + 30);
select is(
  (select status from billing_documents where trainer_id = '00000000-0000-0000-0000-0000000006b2'),
  'auto_approved',
  'Nach Ablauf der Prüffrist automatisch freigegeben'
);

-- ── Einstellungen ──────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000006a2');
update company_billing_settings set review_days = 7 where company_id = '00000000-0000-0000-0000-00000000b090';
reset role;
select is(
  (select review_days from company_billing_settings where company_id = '00000000-0000-0000-0000-00000000b090'),
  3::smallint,
  'Koordinator:in kann die Abrechnungs-Einstellungen nicht ändern'
);

select * from finish();
rollback;
