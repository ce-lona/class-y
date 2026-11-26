-- pgTAP-Test für Hilfe & Support (Migration 20261126090000): Support-Empfänger,
-- Kontaktformular-Nachrichten (Rate-Limit, RLS) und Onboarding-Merker.
-- Ausführbar mit `supabase test db`; läuft in einer Transaktion und wird zurückgerollt.
begin;
select plan(22);

-- Lokale Daten (z.B. aus E2E-Läufen) ausblenden; wird am Ende zurückgerollt.
delete from support_recipients;
delete from support_messages;

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000e001', 'pa@support.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000e0a1', 'admin@support.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000e0c1', 'trainer@support.test', 'authenticated', 'authenticated');

insert into platform_admins (user_id) values ('00000000-0000-0000-0000-00000000e001');
update profiles set full_name = 'Tara Trainer' where id = '00000000-0000-0000-0000-00000000e0c1';

insert into companies (id, name) values ('00000000-0000-0000-0000-00000000e100', 'Support Studio GmbH');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-00000000e0a1', '00000000-0000-0000-0000-00000000e100');
insert into contracts (trainer_id, company_id, employment_type, rate_model, rate_amount, valid_from, status, accepted_at)
values ('00000000-0000-0000-0000-00000000e0c1', '00000000-0000-0000-0000-00000000e100',
        'freelancer', 'per_course', 40, current_date - 30, 'active', now());

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Support-Empfänger
-- ─────────────────────────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-00000000e0a1');
select throws_ok(
  $$ select add_support_recipient('admin@support.test') $$,
  'not_authorized',
  'Company-Admin darf keine Support-Empfänger anlegen'
);
select is((select count(*)::int from support_recipients), 0, 'Company-Admin sieht keine Support-Empfänger');
select throws_ok(
  $$ insert into support_recipients (email) values ('x@support.test') $$,
  '42501', null,
  'Direktes Einfügen in support_recipients ist gesperrt'
);
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000e001');
select lives_ok($$ select add_support_recipient('  Hilfe@Class-Y.test ') $$, 'Plattform-Admin legt Empfänger an');
select is((select array_agg(email) from support_recipients), array['hilfe@class-y.test'], 'Adresse wird getrimmt und klein geschrieben');
select throws_ok($$ select add_support_recipient('hilfe@class-y.test') $$, 'already_exists', 'Doppelte Adresse wird abgelehnt');
select throws_ok($$ select add_support_recipient('keine-mail') $$, 'invalid_email', 'Ungültige Adresse wird abgelehnt');
select throws_ok($$ select remove_support_recipient('hilfe@class-y.test') $$, 'last_recipient', 'Letzte Adresse kann nicht entfernt werden');
select lives_ok($$ select add_support_recipient('zweite@class-y.test') $$, 'Zweite Adresse');
select lives_ok($$ select remove_support_recipient('hilfe@class-y.test') $$, 'Mit zwei Adressen darf eine entfernt werden');
select is((select count(*)::int from support_recipients), 1, 'Eine Adresse bleibt');
reset role;

-- ─────────────────────────────────────────────────────────────────
-- Kontaktformular
-- ─────────────────────────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-00000000e0c1');
select is(
  (select submit_support_message('question', '  Wie trage ich eine Vertretung ein?  ', 'trainer', '{"page":"/help"}') - 'id'),
  jsonb_build_object('sender_email', 'trainer@support.test', 'sender_name', 'Tara Trainer',
                     'companies', jsonb_build_array('Support Studio GmbH')),
  'Nachricht liefert Absenderangaben inkl. Company'
);
select is(
  (select message from support_messages where sender_id = '00000000-0000-0000-0000-00000000e0c1'),
  'Wie trage ich eine Vertretung ein?',
  'Nachricht wird getrimmt gespeichert und ist für die absendende Person lesbar'
);
select throws_ok($$ select submit_support_message('question', '   ', 'trainer') $$, 'message_required', 'Leere Nachricht wird abgelehnt');
select throws_ok(
  $$ insert into support_messages (sender_id, topic, message, role)
     values ('00000000-0000-0000-0000-00000000e0c1', 'other', 'x', 'trainer') $$,
  '42501', null,
  'Direktes Einfügen in support_messages ist gesperrt'
);
select lives_ok(
  $$ select submit_support_message('other', 'Nachricht ' || g, 'trainer') from generate_series(2, 5) g $$,
  'Bis zu fünf Nachrichten pro Stunde'
);
select throws_ok($$ select submit_support_message('other', 'Nummer sechs', 'trainer') $$, 'rate_limited', 'Sechste Nachricht in einer Stunde wird abgelehnt');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000e0a1');
select is((select count(*)::int from support_messages), 0, 'Company-Admin sieht fremde Support-Nachrichten nicht');
select throws_ok(
  $$ select * from support_sender_details(array['00000000-0000-0000-0000-00000000e0c1'::uuid]) $$,
  'not_authorized',
  'Absenderdetails nur für Plattform-Admins'
);
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000e001');
select is((select count(*)::int from support_messages), 5, 'Plattform-Admin sieht alle Support-Nachrichten');
reset role;

-- ─────────────────────────────────────────────────────────────────
-- Onboarding
-- ─────────────────────────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-00000000e0c1');
select mark_onboarding_seen('trainer');
select mark_onboarding_seen('trainer');
select is(
  (select onboarding_seen from profiles where id = '00000000-0000-0000-0000-00000000e0c1'),
  array['trainer'],
  'Onboarding-Rolle wird einmal vermerkt'
);
reset role;

-- Konto löschen entfernt die Support-Nachrichten der Person
delete from auth.users where id = '00000000-0000-0000-0000-00000000e0c1';
select is(
  (select count(*)::int from support_messages where sender_id = '00000000-0000-0000-0000-00000000e0c1'),
  0,
  'Support-Nachrichten werden mit dem Konto gelöscht'
);

select * from finish();
rollback;
