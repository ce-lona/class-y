-- pgTAP-Test für get_company_team (Migration 20261128160000_company_team).
begin;
select plan(14);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000008a1', 'admin@team.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000008a2', 'studio@team.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000008b1', 'trainer@team.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000008c1', 'fremd@team.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000008d1', 'neu@team.test', 'authenticated', 'authenticated');

insert into companies (id, name) values
  ('00000000-0000-0000-0000-00000000d080', 'Team GmbH'),
  ('00000000-0000-0000-0000-00000000d081', 'Andere GmbH');
insert into company_admins (user_id, company_id) values
  ('00000000-0000-0000-0000-0000000008a1', '00000000-0000-0000-0000-00000000d080'),
  ('00000000-0000-0000-0000-0000000008c1', '00000000-0000-0000-0000-00000000d081');
insert into studios (id, company_id, name) values
  ('00000000-0000-0000-0000-00000000d181', '00000000-0000-0000-0000-00000000d080', 'Studio Mitte');
insert into studio_coordinators (user_id, studio_id) values
  ('00000000-0000-0000-0000-0000000008a2', '00000000-0000-0000-0000-00000000d181');
insert into contracts (trainer_id, company_id, employment_type, rate_model, rate_amount, valid_from, status)
values
  ('00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-00000000d080', 'freelancer', 'per_course', 40, current_date - 60, 'ended'),
  ('00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-00000000d080', 'freelancer', 'per_course', 45, current_date - 10, 'pending');
update contracts set created_at = now() - interval '60 days'
  where trainer_id = '00000000-0000-0000-0000-0000000008b1' and status = 'ended';

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
select is((select count(*)::int from get_company_team('00000000-0000-0000-0000-00000000d080')), 3,
  'Company-Admin sieht Admin, Studio-Admin und Trainer:in');
select is((select role from get_company_team('00000000-0000-0000-0000-00000000d080') where email = 'admin@team.test'),
  'company_admin', 'Admin hat Rolle company_admin');
select is((select role from get_company_team('00000000-0000-0000-0000-00000000d080') where email = 'studio@team.test'),
  'coordinator', 'Studio-Admin hat Rolle coordinator');
select is((select studio_ids from get_company_team('00000000-0000-0000-0000-00000000d080') where email = 'studio@team.test'),
  array['00000000-0000-0000-0000-00000000d181'::uuid], 'Studio-Admin mit zugewiesenem Studio');
select is((select contract_status from get_company_team('00000000-0000-0000-0000-00000000d080') where email = 'trainer@team.test'),
  'pending', 'Trainer:in erscheint einmal mit dem neuesten Vertrag');
select ok((select bool_and(updated_at is not null) from get_company_team('00000000-0000-0000-0000-00000000d080')),
  'Alle Einträge haben einen Änderungszeitpunkt');
select is((select count(*)::int from get_company_team('00000000-0000-0000-0000-00000000d080') where email = 'fremd@team.test'), 0,
  'Admins anderer Companies erscheinen nicht');

select is(set_team_member_name('00000000-0000-0000-0000-00000000d080', 'trainer@team.test', '  Tina Trainer '), true,
  'Admin setzt den Namen einer Trainer:in ohne Namen');
select is(set_team_member_name('00000000-0000-0000-0000-00000000d080', 'trainer@team.test', 'Anders'), false,
  'Ein vorhandener Name wird nicht überschrieben');
select throws_ok($$ select set_team_member_name('00000000-0000-0000-0000-00000000d080', 'fremd@team.test', 'X') $$,
  'not_a_member', 'Nur Personen der eigenen Company');
select lives_ok($$ select add_company_admin('00000000-0000-0000-0000-00000000d080', 'neu@team.test') $$,
  'Company-Admin fügt weitere Admins der eigenen Company hinzu');
select throws_ok($$ select add_company_admin('00000000-0000-0000-0000-00000000d081', 'neu@team.test') $$,
  'not_authorized', 'aber nicht in fremden Companies');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000008a2');
select throws_ok($$ select * from get_company_team('00000000-0000-0000-0000-00000000d080') $$,
  'not_authorized', 'Studio-Admin darf die Team-Übersicht nicht abrufen');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000008c1');
select throws_ok($$ select * from get_company_team('00000000-0000-0000-0000-00000000d080') $$,
  'not_authorized', 'Admin einer anderen Company darf nicht');
reset role;

select * from finish();
rollback;
