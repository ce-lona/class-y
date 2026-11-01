-- Vor dem Einspielen REPLACE_ME_ADMIN_EMAIL durch die E-Mail des ersten Admins ersetzen.
-- Die Person muss in auth.users bereits existieren, sonst wird nichts eingetragen.
-- Bootstrap: erster platform_admin (erster Admin)
insert into platform_admins (user_id)
select id from auth.users where email = 'REPLACE_ME_ADMIN_EMAIL'
on conflict (user_id) do nothing;
