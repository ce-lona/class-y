-- pgTAP-Test für profiles (strukturierte Adresse + RLS), ausführbar mit `supabase test db`.
-- Läuft in einer Transaktion und wird zurückgerollt.
begin;
select plan(10);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000001a1', 'admin@profiles.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000001b1', 'trainer@profiles.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000001c1', 'other@profiles.test', 'authenticated', 'authenticated');

insert into companies (id, name) values ('00000000-0000-0000-0000-00000000d0d0', 'Profile Test Company');
insert into company_admins (user_id, company_id)
values ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000d0d0');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- 1. Trainer:in kann eigene Stammdaten inkl. strukturierter Adresse aktualisieren
select pg_temp.login('00000000-0000-0000-0000-0000000001b1');

update profiles
set full_name = 'Alex Trainer',
    phone = '+49 170 1234567',
    street = 'Musterstraße',
    house_number = '12a',
    postal_code = '10115',
    city = 'Berlin',
    country = 'DE',
    kleinunternehmer = true
where id = '00000000-0000-0000-0000-0000000001b1';

select is(
  (select full_name from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  'Alex Trainer',
  'Trainer:in kann eigenen Namen speichern'
);

select is(
  (select street || ' ' || house_number || ', ' || postal_code || ' ' || city || ', ' || country
   from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  'Musterstraße 12a, 10115 Berlin, DE',
  'Trainer:in kann strukturierte Adresse speichern'
);

select is(
  (select kleinunternehmer from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  true,
  'Trainer:in kann Kleinunternehmer-Status speichern'
);

-- 2. Trainer:in darf eigenes Profil nicht löschen
delete from profiles where id = '00000000-0000-0000-0000-0000000001b1';

select is(
  (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  1::bigint,
  'Nutzer:innen dürfen ihr eigenes Profil nicht löschen'
);

-- 3. Fremde Person sieht und ändert das Profil nicht
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000001c1');

select is(
  (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  0::bigint,
  'Fremde Person sieht das Profil einer anderen Trainer:in nicht'
);

update profiles set full_name = 'Gehackt' where id = '00000000-0000-0000-0000-0000000001b1';

reset role;
select is(
  (select full_name from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  'Alex Trainer',
  'Fremde Person kann das Profil einer anderen Trainer:in nicht ändern'
);

-- 4. Company-Admin sieht Profil erst nach Annahme des Vertrags, nie schreibend
select pg_temp.login('00000000-0000-0000-0000-0000000001a1');

create temp table contract_ids (id uuid);
grant all on contract_ids to authenticated;

insert into contract_ids
select offer_contract(
  '00000000-0000-0000-0000-00000000d0d0', 'trainer@profiles.test',
  'freelancer', 'per_course', 45.00, current_date, null
);

select is(
  (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  0::bigint,
  'Company-Admin sieht Trainer-Profil bei offenem Angebot noch nicht'
);

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000001b1');
select accept_contract((select id from contract_ids));

reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000001a1');

select is(
  (select city from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  'Berlin',
  'Company-Admin sieht Trainer-Profil nach Annahme des Vertrags lesend'
);

update profiles set full_name = 'Admin Überschreibung' where id = '00000000-0000-0000-0000-0000000001b1';

reset role;
select is(
  (select full_name from profiles where id = '00000000-0000-0000-0000-0000000001b1'),
  'Alex Trainer',
  'Company-Admin kann Trainer-Profil nicht bearbeiten'
);

-- 5. Default-Land bei neu angelegtem Profil ist DE
select is(
  (select country from profiles where id = '00000000-0000-0000-0000-0000000001c1'),
  'DE',
  'Neues Profil bekommt Standard-Land DE'
);

select * from finish();
rollback;
