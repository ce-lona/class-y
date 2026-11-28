-- pgTAP-Test für die E-Mail-Benachrichtigungen zu Gutschriften/Nachweisen
-- (Migration 20261128120000_billing_notifications). Läuft in einer Transaktion und wird zurückgerollt.
begin;
select plan(22);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000007a1', 'admin@notify.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007a2', 'nord@notify.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007a3', 'sued@notify.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007b1', 'sabine@notify.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007b2', 'lena@notify.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007b3', 'marco@notify.test', 'authenticated', 'authenticated');

insert into companies (id, name, street, house_number, postal_code, city)
values ('00000000-0000-0000-0000-00000000c090', 'Notify GmbH', 'Musterstraße', '12', '70173', 'Stuttgart');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-00000000c090');
insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-00000000c191', '00000000-0000-0000-0000-00000000c090', 'Studio Nord'),
  ('00000000-0000-0000-0000-00000000c292', '00000000-0000-0000-0000-00000000c090', 'Studio Süd');
insert into studio_coordinators (user_id, studio_id) values
  ('00000000-0000-0000-0000-0000000007a2', '00000000-0000-0000-0000-00000000c191'),
  ('00000000-0000-0000-0000-0000000007a3', '00000000-0000-0000-0000-00000000c292');
insert into course_types (id, company_id, name, default_duration_min)
values ('00000000-0000-0000-0000-00000000c393', '00000000-0000-0000-0000-00000000c090', 'Yoga', 60);

-- Mails für Nachweise zunächst aus.
insert into company_billing_settings (company_id, employee_statements, notify_document_ready)
values ('00000000-0000-0000-0000-00000000c090', true, false);

create temp table tmp_nt (k text primary key, id uuid, d date);
grant all on tmp_nt to authenticated, service_role;
insert into tmp_nt (k, d) values ('m', date_trunc('month', current_date - interval '2 months')::date);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;
create function pg_temp.m() returns date language sql stable as $$ select d from tmp_nt where k = 'm' $$;
create function pg_temp.id(key text) returns uuid language sql stable as $$ select id from tmp_nt where k = key $$;

-- Verträge: Sabine und Lena freiberuflich, Marco Minijob.
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
insert into tmp_nt (k, id) select 'c_sabine', offer_contract('00000000-0000-0000-0000-00000000c090', 'sabine@notify.test', 'freelancer', 'per_course', 50, pg_temp.m() - 30, null);
insert into tmp_nt (k, id) select 'c_lena', offer_contract('00000000-0000-0000-0000-00000000c090', 'lena@notify.test', 'freelancer', 'per_course', 40, pg_temp.m() - 30, null);
insert into tmp_nt (k, id) select 'c_marco', offer_contract('00000000-0000-0000-0000-00000000c090', 'marco@notify.test', 'minijob', 'hourly', 15, pg_temp.m() - 30, null);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
select accept_contract_with_master_data(pg_temp.id('c_sabine'), 'Sabine Muster', 'Lindenweg', '4', '70190', 'Stuttgart', 'DE02120300000000202051', '99/123/45678', null, false, true);
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b2');
select accept_contract_with_master_data(pg_temp.id('c_lena'), 'Lena Probe', 'Gartenstraße', '21', '70180', 'Stuttgart', 'DE02120300000000202051', null, 'DE123456789', true, true);
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b3');
select accept_contract_with_master_data(pg_temp.id('c_marco'), 'Marco Beispiel', 'Hauptstraße', '8', '70176', 'Stuttgart', 'DE02120300000000202051', null, null, null, false);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select confirm_contract(pg_temp.id('c_sabine'));
select confirm_contract(pg_temp.id('c_lena'));
select confirm_contract(pg_temp.id('c_marco'));

-- Kurse: Sabine Nord, Lena Süd, Marco Nord.
reset role;
insert into course_sessions (studio_id, course_type_id, date, start_time, end_time, trainer_id, status)
values
  ('00000000-0000-0000-0000-00000000c191', '00000000-0000-0000-0000-00000000c393', pg_temp.m() + 1, '10:00', '11:00', '00000000-0000-0000-0000-0000000007b1', 'completed'),
  ('00000000-0000-0000-0000-00000000c292', '00000000-0000-0000-0000-00000000c393', pg_temp.m() + 2, '10:00', '11:00', '00000000-0000-0000-0000-0000000007b2', 'completed'),
  ('00000000-0000-0000-0000-00000000c191', '00000000-0000-0000-0000-00000000c393', pg_temp.m() + 3, '10:00', '11:00', '00000000-0000-0000-0000-0000000007b3', 'completed');

-- ── Ausgeschaltet: keine Mail bei neuen Belegen ────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select is(
  issue_billing_documents('00000000-0000-0000-0000-00000000c090', pg_temp.m(), null),
  '{"created": 2, "skipped": 0, "cancelled": 0, "statements": 1}'::jsonb,
  'Zwei Gutschriften und ein Nachweis ausgestellt'
);
reset role;
select is((select count(*) from billing_notifications), 0::bigint,
  'Ausgeschaltet: keine Benachrichtigung bei neuen Belegen');

-- ── Eingeschaltet: Mail an die Trainer:in ──────────────────────
update company_billing_settings set notify_document_ready = true
where company_id = '00000000-0000-0000-0000-00000000c090';
insert into course_sessions (studio_id, course_type_id, date, start_time, end_time, trainer_id, status)
values
  ('00000000-0000-0000-0000-00000000c191', '00000000-0000-0000-0000-00000000c393', pg_temp.m() + 8, '10:00', '11:00', '00000000-0000-0000-0000-0000000007b1', 'completed'),
  ('00000000-0000-0000-0000-00000000c191', '00000000-0000-0000-0000-00000000c393', pg_temp.m() + 9, '10:00', '11:00', '00000000-0000-0000-0000-0000000007b3', 'completed');

select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select is(
  issue_billing_documents('00000000-0000-0000-0000-00000000c090', pg_temp.m(), null),
  '{"created": 1, "skipped": 0, "cancelled": 1, "statements": 1}'::jsonb,
  'Neue Gutschrift (Sabine) und neue Nachweis-Version (Marco)'
);
select is((select count(*) from billing_notifications), 0::bigint,
  'Company-Admin sieht die Outbox nicht');
reset role;

select is(
  (select string_agg(d.kind || ':' || u.email, ', ' order by u.email)
   from billing_notifications n
   join billing_documents d on d.id = n.document_id
   join auth.users u on u.id = n.recipient_id
   where n.kind = 'document_ready'),
  'statement:marco@notify.test, credit_note:sabine@notify.test',
  'Je eine Mail für neue Gutschrift und neuen Nachweis, keine für die Stornogutschrift'
);

-- ── Korrekturwunsch → Admins + Koordinator:in des Studios ──────
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
insert into tmp_nt (k, id)
select 'gs_sabine', id from get_my_billing_documents() where kind = 'credit_note' and status = 'open';
select comment_billing_document(pg_temp.id('gs_sabine'), 'Der Kurs am 9. fehlt.');
reset role;

select is(
  (select string_agg(u.email, ', ' order by u.email)
   from billing_notifications n join auth.users u on u.id = n.recipient_id
   where n.kind = 'correction_request'),
  'admin@notify.test, nord@notify.test',
  'Korrekturwunsch geht an Company-Admin und Koordinator:in Nord, nicht an Süd'
);

-- Persönlich abbestellt: Koordinator:in Nord bekommt keine Korrektur-Mail mehr.
update profiles set mail_correction_request = false where id = '00000000-0000-0000-0000-0000000007a2';
insert into billing_comments (document_id, author_id, kind, body)
values (pg_temp.id('gs_sabine'), '00000000-0000-0000-0000-0000000007b1', 'correction_request', 'Noch etwas');
select is(
  (select string_agg(u.email, ', ')
   from billing_notifications n
   join billing_comments c on c.id = n.comment_id
   join auth.users u on u.id = n.recipient_id
   where c.body = 'Noch etwas'),
  'admin@notify.test',
  'Persönlich abbestellt: nur noch der Admin bekommt die Mail'
);
delete from billing_comments where body = 'Noch etwas';
update profiles set mail_correction_request = true where id = '00000000-0000-0000-0000-0000000007a2';

-- Autor:in bekommt keine Mail zum eigenen Kommentar.
insert into billing_comments (document_id, author_id, kind, body)
values (pg_temp.id('gs_sabine'), '00000000-0000-0000-0000-0000000007a1', 'correction_request', 'Notiz vom Admin');
select is(
  (select string_agg(u.email, ', ')
   from billing_notifications n
   join billing_comments c on c.id = n.comment_id
   join auth.users u on u.id = n.recipient_id
   where c.body = 'Notiz vom Admin'),
  'nord@notify.test',
  'Autor:in ist ausgenommen'
);

-- Ausgeschaltet: kein Mail zum Kommentar auf dem Nachweis.
update company_billing_settings set notify_correction_request = false
where company_id = '00000000-0000-0000-0000-00000000c090';
select pg_temp.login('00000000-0000-0000-0000-0000000007b3');
select comment_billing_document(
  (select id from get_my_billing_documents() where status = 'issued' limit 1), 'Kurs ging länger.');
reset role;
select is(
  (select count(*) from billing_notifications n join billing_comments c on c.id = n.comment_id
   where c.body = 'Kurs ging länger.'),
  0::bigint,
  'Ausgeschaltet: keine Mail zu Kommentaren'
);

-- ── Erinnerung am letzten Prüftag ──────────────────────────────
insert into tmp_nt (k, d)
select 'due', review_due from billing_documents
where trainer_id = '00000000-0000-0000-0000-0000000007b2' and kind = 'credit_note' and status = 'open';

-- Persönlich abbestellt: keine Erinnerung, obwohl die Company sie verschickt.
select pg_temp.login('00000000-0000-0000-0000-0000000007b2');
update profiles set mail_review_reminder = false where id = '00000000-0000-0000-0000-0000000007b2';
reset role;
select billing_run_daily((select d from tmp_nt where k = 'due'));
select is((select count(*) from billing_notifications where kind = 'review_reminder'), 0::bigint,
  'Persönlich abbestellt: keine Erinnerung');
update profiles set mail_review_reminder = true where id = '00000000-0000-0000-0000-0000000007b2';

select billing_run_daily((select d from tmp_nt where k = 'due') - 1);
select is((select count(*) from billing_notifications where kind = 'review_reminder'), 0::bigint,
  'Vor dem letzten Prüftag keine Erinnerung');

select is(
  (billing_run_daily((select d from tmp_nt where k = 'due'))) ->> 'reminders',
  '1',
  'Am letzten Prüftag eine Erinnerung (nur Lenas offene Gutschrift)'
);
select billing_run_daily((select d from tmp_nt where k = 'due'));
select is(
  (select count(*) from billing_notifications n join auth.users u on u.id = n.recipient_id
   where n.kind = 'review_reminder' and u.email = 'lena@notify.test'),
  1::bigint,
  'Erneuter Lauf am selben Tag erzeugt keine zweite Erinnerung'
);

update company_billing_settings set notify_review_reminder = false
where company_id = '00000000-0000-0000-0000-00000000c090';
delete from billing_notifications where kind = 'review_reminder';
select billing_run_daily((select d from tmp_nt where k = 'due'));
select is((select count(*) from billing_notifications where kind = 'review_reminder'), 0::bigint,
  'Ausgeschaltet: keine Erinnerung');
update company_billing_settings set notify_review_reminder = true
where company_id = '00000000-0000-0000-0000-00000000c090';
select billing_run_daily((select d from tmp_nt where k = 'due'));

-- ── Versand-RPCs ───────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select throws_ok($$ select * from billing_pending_notifications(50) $$, '42501', null,
  'authenticated darf ausstehende Mails nicht abholen');
select throws_ok(
  format('select mark_billing_notification(%L, null)', gen_random_uuid()), '42501', null,
  'authenticated darf Mails nicht quittieren');
reset role;

create temp table tmp_pending as select * from billing_pending_notifications(0);
grant all on tmp_pending to service_role;
set local role service_role;
insert into tmp_pending select * from billing_pending_notifications(50);
select is((select count(*) from tmp_pending), 6::bigint,
  'service_role holt alle 6 ausstehenden Mails ab (2 Belege, 3 Korrekturwünsche, 1 Erinnerung)');
select is(
  (select comment_body || ' / ' || trainer_name || ' / ' || document_number
   from tmp_pending where kind = 'correction_request' and recipient_email = 'admin@notify.test'),
  'Der Kurs am 9. fehlt. / Sabine Muster / ' || (select number from billing_documents where id = pg_temp.id('gs_sabine')),
  'Korrektur-Mail enthält Kommentar, Name und Nummer'
);
select is((select count(*) from billing_pending_notifications(50)), 0::bigint,
  'Reservierte Mails werden nicht doppelt abgeholt');

select mark_billing_notification(id, null) from tmp_pending where kind <> 'review_reminder';
select mark_billing_notification(id, 'smtp timeout') from tmp_pending where kind = 'review_reminder';
select is(
  (select string_agg(kind, ', ') from billing_pending_notifications(50)),
  'review_reminder',
  'Fehlgeschlagene Mail wird erneut versucht, versendete nicht'
);
reset role;

update billing_notifications set attempts = 5, claimed_at = null where kind = 'review_reminder';
set local role service_role;
select is((select count(*) from billing_pending_notifications(50)), 0::bigint,
  'Nach 5 Fehlversuchen wird aufgegeben');
reset role;

-- ── DSGVO ──────────────────────────────────────────────────────
select gdpr_scrub_profile('00000000-0000-0000-0000-0000000007a2');
select is(
  (select count(*) from billing_notifications where recipient_id = '00000000-0000-0000-0000-0000000007a2'),
  0::bigint,
  'Gelöschtes Konto: Benachrichtigungen an die Person entfallen'
);

select * from finish();
rollback;
