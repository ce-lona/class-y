-- Lokale Demo-Daten zum Durchklicken der Rollen-Views. Läuft automatisch bei `supabase db reset`
-- (siehe [db.seed] in config.toml). NUR lokal verwenden, nie gegen ein Remote-Projekt.
--
-- Logins (alle mit Passwort: classy-demo)
--   company-admin@classy.test  Company-Admin der „Demo Fitness GmbH“ (beide Studios)
--   koordinator@classy.test    Kurskoordinator:in, nur „Studio Mitte“
--   trainer@classy.test        Trainer:in mit aktivem Vertrag (beide Studios), Kursen und erfassten Stunden
--   trainer2@classy.test       zweite Trainer:in (Studio Mitte), z. B. als Vertretung
--
-- Der Platform-Admin wird hier nicht angelegt (eigener Account, siehe README).

begin;

-- ── Auth-Accounts ──────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('classy-demo', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('d0000000-0000-0000-0000-0000000000a1'::uuid, 'company-admin@classy.test'),
  ('d0000000-0000-0000-0000-0000000000a2'::uuid, 'koordinator@classy.test'),
  ('d0000000-0000-0000-0000-0000000000b1'::uuid, 'trainer@classy.test'),
  ('d0000000-0000-0000-0000-0000000000b2'::uuid, 'trainer2@classy.test')
) as u(id, email);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u
where u.email like '%@classy.test';

update profiles p set full_name = v.name, phone = v.phone, city = 'Berlin'
from (values
  ('d0000000-0000-0000-0000-0000000000a1'::uuid, 'Clara Admin', '030 1234567'),
  ('d0000000-0000-0000-0000-0000000000a2'::uuid, 'Kai Koordinator', '030 2345678'),
  ('d0000000-0000-0000-0000-0000000000b1'::uuid, 'Tina Trainerin', '0171 1111111'),
  ('d0000000-0000-0000-0000-0000000000b2'::uuid, 'Tom Trainer', '0171 2222222')
) as v(id, name, phone)
where p.id = v.id;

-- ── Company, Studios, Kursarten ────────────────────────────────
insert into companies (id, name) values ('d0000000-0000-0000-0000-00000000c001', 'Demo Fitness GmbH');

insert into company_admins (user_id, company_id)
values ('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-00000000c001');

insert into studios (id, company_id, name, street, house_number, postal_code, city) values
  ('d0000000-0000-0000-0000-00000000e001', 'd0000000-0000-0000-0000-00000000c001', 'Studio Mitte', 'Torstraße', '12', '10119', 'Berlin'),
  ('d0000000-0000-0000-0000-00000000e002', 'd0000000-0000-0000-0000-00000000c001', 'Studio Nord', 'Müllerstraße', '80', '13349', 'Berlin');

insert into course_types (id, company_id, name, default_duration_min) values
  ('d0000000-0000-0000-0000-0000000c7001', 'd0000000-0000-0000-0000-00000000c001', 'Cycling', 45),
  ('d0000000-0000-0000-0000-0000000c7002', 'd0000000-0000-0000-0000-00000000c001', 'Yoga', 60),
  ('d0000000-0000-0000-0000-0000000c7003', 'd0000000-0000-0000-0000-00000000c001', 'Pilates', 50);

insert into course_type_studios (course_type_id, studio_id)
select ct.id, s.id
from course_types ct cross join studios s
where ct.company_id = 'd0000000-0000-0000-0000-00000000c001' and s.company_id = ct.company_id;

-- ── Ab hier über die echten RPCs, jeweils als die passende Person ──
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create temp table seed_ids (k text primary key, id uuid);
grant all on seed_ids to authenticated;


-- Company-Admin: Koordinator:in für Studio Mitte, Verträge anbieten
select pg_temp.login('d0000000-0000-0000-0000-0000000000a1');
select set_studio_coordinator_studios(
  'd0000000-0000-0000-0000-00000000c001', 'koordinator@classy.test',
  array['d0000000-0000-0000-0000-00000000e001'::uuid]
);
insert into seed_ids select 't1', offer_contract(
  'd0000000-0000-0000-0000-00000000c001', 'trainer@classy.test',
  'freelancer', 'per_course', 40, current_date - 60, null,
  array['d0000000-0000-0000-0000-00000000e001'::uuid, 'd0000000-0000-0000-0000-00000000e002'::uuid]
);
insert into seed_ids select 't2', offer_contract(
  'd0000000-0000-0000-0000-00000000c001', 'trainer2@classy.test',
  'minijob', 'hourly', 25, current_date - 60, null,
  array['d0000000-0000-0000-0000-00000000e001'::uuid]
);

reset role;
select pg_temp.login('d0000000-0000-0000-0000-0000000000b1');
select accept_contract((select id from seed_ids where k = 't1'));

reset role;
select pg_temp.login('d0000000-0000-0000-0000-0000000000b2');
select accept_contract((select id from seed_ids where k = 't2'));

-- Kurspläne (gültig ab Montag vor drei Wochen, damit es Vergangenheit und Zukunft gibt)
reset role;
select pg_temp.login('d0000000-0000-0000-0000-0000000000a2');
select publish_course_plan(
  'd0000000-0000-0000-0000-00000000e001',
  date_trunc('week', current_date)::date - 21,
  jsonb_build_array(
    jsonb_build_object('weekday', 1, 'start_time', '18:00', 'end_time', '18:45', 'course_type_id', 'd0000000-0000-0000-0000-0000000c7001', 'trainer_id', 'd0000000-0000-0000-0000-0000000000b1'),
    jsonb_build_object('weekday', 2, 'start_time', '09:00', 'end_time', '10:00', 'course_type_id', 'd0000000-0000-0000-0000-0000000c7002', 'trainer_id', 'd0000000-0000-0000-0000-0000000000b2'),
    jsonb_build_object('weekday', 3, 'start_time', '19:00', 'end_time', '19:50', 'course_type_id', 'd0000000-0000-0000-0000-0000000c7003', 'trainer_id', 'd0000000-0000-0000-0000-0000000000b1'),
    jsonb_build_object('weekday', 4, 'start_time', '18:00', 'end_time', '18:45', 'course_type_id', 'd0000000-0000-0000-0000-0000000c7001', 'trainer_id', 'd0000000-0000-0000-0000-0000000000b2'),
    jsonb_build_object('weekday', 6, 'start_time', '10:00', 'end_time', '11:00', 'course_type_id', 'd0000000-0000-0000-0000-0000000c7002', 'trainer_id', 'd0000000-0000-0000-0000-0000000000b1')
  )
);

reset role;
select pg_temp.login('d0000000-0000-0000-0000-0000000000a1');
select publish_course_plan(
  'd0000000-0000-0000-0000-00000000e002',
  date_trunc('week', current_date)::date - 21,
  jsonb_build_array(
    jsonb_build_object('weekday', 2, 'start_time', '17:30', 'end_time', '18:15', 'course_type_id', 'd0000000-0000-0000-0000-0000000c7001', 'trainer_id', 'd0000000-0000-0000-0000-0000000000b1'),
    jsonb_build_object('weekday', 5, 'start_time', '07:30', 'end_time', '08:20', 'course_type_id', 'd0000000-0000-0000-0000-0000000c7003', 'trainer_id', 'd0000000-0000-0000-0000-0000000000b1')
  )
);

-- Erfasste Stunden der letzten drei Wochen (bis gestern) für beide Trainer:innen
reset role;
insert into course_sessions (studio_id, course_plan_slot_id, date, start_time, end_time, trainer_id, status, logged_by)
select p.studio_id, sl.id, d::date, sl.start_time, sl.end_time, sl.trainer_id,
       case when extract(day from d)::int % 9 = 0 then 'cancelled' else 'completed' end,
       sl.trainer_id
from course_plan_slots sl
join course_plans p on p.id = sl.course_plan_id
cross join generate_series(date_trunc('week', current_date)::date - 21, current_date - 1, interval '1 day') d
where p.studio_id in ('d0000000-0000-0000-0000-00000000e001', 'd0000000-0000-0000-0000-00000000e002')
  and extract(isodow from d)::int = sl.weekday;


commit;
