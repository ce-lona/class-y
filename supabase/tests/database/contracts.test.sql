-- pgTAP-Test für die Vertragsannahme (Migration 20261102010000/20261102020000),
-- ausführbar mit `supabase test db`. Läuft in einer Transaktion und wird zurückgerollt.
begin;
select plan(22);

-- ─────────────────────────────────────────────────────────────────
-- Testdaten (als postgres): Company-Admin, Trainer:in, fremde Trainer:in, Company
-- ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@contracts.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'trainer@contracts.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'other@contracts.test', 'authenticated', 'authenticated');

insert into companies (id, name) values ('00000000-0000-0000-0000-00000000c0c0', 'Test Company');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c0c0');

-- Rolle und auth.uid() wie bei einer echten Anfrage setzen
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Angebot durch den Company-Admin
-- ─────────────────────────────────────────────────────────────────
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

insert into ids
select 'first', offer_contract(
  '00000000-0000-0000-0000-00000000c0c0', 'trainer@contracts.test',
  'freelancer', 'per_course', 42.50, current_date, null
);

select is(
  (select status from contracts where id = (select id from ids where name = 'first')),
  'pending',
  'offer_contract legt das Angebot als pending an'
);

select throws_ok(
  $$ select offer_contract('00000000-0000-0000-0000-00000000c0c0', 'nobody@contracts.test',
       'freelancer', 'per_course', 1, current_date, null) $$,
  'P0001', 'user_not_found',
  'offer_contract meldet unbekannte E-Mail-Adressen als user_not_found'
);

-- ─────────────────────────────────────────────────────────────────
-- Admins können die Annahme nicht umgehen
-- ─────────────────────────────────────────────────────────────────
select throws_ok(
  format('select accept_contract(%L)', (select id from ids where name = 'first')),
  'P0001', 'contract_not_found_or_not_acceptable',
  'Admin kann ein Angebot nicht selbst annehmen (accept_contract)'
);

select throws_ok(
  format($$ update contracts set status = 'active' where id = %L $$, (select id from ids where name = 'first')),
  'P0001', 'contract_status_transition_not_allowed',
  'Admin kann den Status nicht direkt auf active setzen'
);

select throws_ok(
  format($$ update contracts set accepted_at = now() where id = %L $$, (select id from ids where name = 'first')),
  'P0001', 'contract_acceptance_immutable',
  'Admin kann accepted_at nicht setzen'
);

select throws_ok(
  $$ insert into contracts (trainer_id, company_id, employment_type, rate_model, rate_amount, valid_from, status)
     values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000c0c0',
             'freelancer', 'per_course', 10, current_date, 'active') $$,
  'P0001', 'contract_must_start_pending',
  'Admin kann keinen bereits aktiven Vertrag einfügen'
);

select throws_ok(
  format('select decline_contract(%L)', (select id from ids where name = 'first')),
  'P0001', 'contract_not_found_or_not_pending',
  'Admin kann ein Angebot nicht im Namen der Trainer:in ablehnen'
);

-- ─────────────────────────────────────────────────────────────────
-- Fremde Trainer:in kann weder annehmen noch sehen
-- ─────────────────────────────────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');

select throws_ok(
  format('select accept_contract(%L)', (select id from ids where name = 'first')),
  'P0001', 'contract_not_found_or_not_acceptable',
  'Fremde Trainer:in kann das Angebot nicht annehmen'
);

select is(
  (select count(*) from get_my_contracts()),
  0::bigint,
  'Fremde Trainer:in sieht das Angebot nicht'
);

select throws_ok(
  $$ select * from get_company_contracts('00000000-0000-0000-0000-00000000c0c0') $$,
  'P0001', 'not_authorized',
  'Trainer:in ohne Admin-Rolle kann die Vertragsliste der Company nicht lesen'
);

-- ─────────────────────────────────────────────────────────────────
-- Annahme durch die Trainer:in
-- ─────────────────────────────────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');

select is(
  (select status from get_my_contracts() where id = (select id from ids where name = 'first')),
  'pending',
  'Trainer:in sieht das eigene Angebot als pending'
);

select lives_ok(
  format('select accept_contract(%L)', (select id from ids where name = 'first')),
  'Trainer:in kann das eigene Angebot annehmen'
);

select ok(
  (select status = 'active' and accepted_at is not null
   from get_my_contracts() where id = (select id from ids where name = 'first')),
  'nach der Annahme ist der Vertrag active und accepted_at gesetzt'
);

select throws_ok(
  format('select decline_contract(%L)', (select id from ids where name = 'first')),
  'P0001', 'contract_not_found_or_not_pending',
  'ein angenommener Vertrag kann nicht mehr abgelehnt werden'
);

-- ─────────────────────────────────────────────────────────────────
-- Konditionen nach der Annahme gesperrt, Beenden erlaubt
-- ─────────────────────────────────────────────────────────────────
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

select throws_ok(
  format($$ update contracts set rate_amount = 99 where id = %L $$, (select id from ids where name = 'first')),
  'P0001', 'contract_terms_locked_after_acceptance',
  'Vergütung ist nach der Annahme gesperrt'
);

select throws_ok(
  format($$ update contracts set valid_from = valid_from - 1 where id = %L $$, (select id from ids where name = 'first')),
  'P0001', 'contract_terms_locked_after_acceptance',
  'Vertragsbeginn ist nach der Annahme gesperrt'
);

select lives_ok(
  format($$ update contracts set status = 'ended' where id = %L $$, (select id from ids where name = 'first')),
  'Admin kann einen angenommenen Vertrag beenden'
);

-- ─────────────────────────────────────────────────────────────────
-- Kein EXECUTE für anon auf den neuen Funktionen
-- ─────────────────────────────────────────────────────────────────
reset role;

select ok(
  not has_function_privilege('anon', 'public.offer_contract(uuid, text, text, text, numeric, date, date, uuid[])', 'execute'),
  'anon darf offer_contract nicht ausführen'
);
select ok(
  not has_function_privilege('anon', 'public.accept_contract(uuid)', 'execute'),
  'anon darf accept_contract nicht ausführen'
);
select ok(
  not has_function_privilege('anon', 'public.decline_contract(uuid)', 'execute'),
  'anon darf decline_contract nicht ausführen'
);
select ok(
  not has_function_privilege('anon', 'public.get_my_contracts()', 'execute'),
  'anon darf get_my_contracts nicht ausführen'
);
select ok(
  not has_function_privilege('anon', 'public.get_company_contracts(uuid)', 'execute'),
  'anon darf get_company_contracts nicht ausführen'
);

select * from finish();
rollback;
