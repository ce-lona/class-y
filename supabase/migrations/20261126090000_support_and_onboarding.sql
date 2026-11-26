-- Hilfe & Support (Launch-Punkt 8)
--   1. support_recipients: E-Mail-Adressen, an die das Kontaktformular geht (nur Plattform-Admins).
--   2. support_messages: jede gesendete Nachricht (Rate-Limit, Versandstatus, Sicherheitsnetz,
--      falls der Mailversand ausfällt). Wird mit dem Konto der absendenden Person gelöscht.
--   3. profiles.onboarding_seen: Rollen, für die der Willkommens-Dialog schon gezeigt wurde.

-- ─────────────────────────────────────────────────────────────────
-- 1. SUPPORT-EMPFÄNGER
-- ─────────────────────────────────────────────────────────────────
create table support_recipients (
  email      text primary key check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  created_at timestamptz not null default now()
);

alter table support_recipients enable row level security;

create policy "support_recipients: platform_admin liest"
  on support_recipients for select
  using (is_platform_admin());
-- Schreiben nur über add_/remove_support_recipient (Mindestens-eine-Adresse-Regel).

create or replace function add_support_recipient(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not is_platform_admin() then
    raise exception 'not_authorized';
  end if;
  if v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_email';
  end if;
  if exists (select 1 from support_recipients where email = v_email) then
    raise exception 'already_exists';
  end if;
  if (select count(*) from support_recipients) >= 10 then
    raise exception 'too_many_recipients';
  end if;
  insert into support_recipients (email) values (v_email);
end;
$$;

create or replace function remove_support_recipient(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'not_authorized';
  end if;
  if (select count(*) from support_recipients) <= 1
     and exists (select 1 from support_recipients where email = lower(trim(p_email))) then
    raise exception 'last_recipient';
  end if;
  delete from support_recipients where email = lower(trim(p_email));
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 2. SUPPORT-NACHRICHTEN
-- ─────────────────────────────────────────────────────────────────
create table support_messages (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references auth.users(id) on delete cascade,
  topic           text not null check (topic in ('question', 'problem', 'idea', 'other')),
  message         text not null check (char_length(message) between 1 and 5000),
  role            text not null check (role in ('admin', 'coordinator', 'trainer', 'platform')),
  context         jsonb not null default '{}'::jsonb,
  attachment_name text,
  mail_status     text not null default 'pending'
                  check (mail_status in ('pending', 'sent', 'failed', 'not_configured')),
  created_at      timestamptz not null default now()
);

create index support_messages_sender_idx on support_messages (sender_id, created_at desc);
create index support_messages_created_idx on support_messages (created_at desc);

alter table support_messages enable row level security;

create policy "support_messages: eigene lesen"
  on support_messages for select
  using (sender_id = auth.uid());

create policy "support_messages: platform_admin liest alle"
  on support_messages for select
  using (is_platform_admin());
-- Anlegen nur über submit_support_message, Versandstatus setzt die Edge Function (service_role).

-- Speichert die Nachricht und liefert die Absenderangaben für die Support-Mail.
-- Rate-Limit: höchstens 5 Nachrichten pro Stunde und Person (außer Plattform-Admins).
create or replace function submit_support_message(
  p_topic text,
  p_message text,
  p_role text,
  p_context jsonb default '{}'::jsonb,
  p_attachment_name text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_message text := trim(p_message);
begin
  if v_uid is null then
    raise exception 'not_authorized';
  end if;
  if v_message is null or v_message = '' then
    raise exception 'message_required';
  end if;
  if char_length(v_message) > 5000 then
    raise exception 'message_too_long';
  end if;
  -- Plattform-Admins sind ausgenommen (eigene Tests, z.B. e2e/help.spec.ts).
  if not is_platform_admin() and (select count(*) from support_messages
      where sender_id = v_uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into support_messages (sender_id, topic, message, role, context, attachment_name)
  values (
    v_uid, p_topic, v_message, p_role,
    coalesce(p_context, '{}'::jsonb),
    left(nullif(trim(p_attachment_name), ''), 200)
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'sender_email', (select email from auth.users where id = v_uid),
    'sender_name', (select full_name from profiles where id = v_uid),
    'companies', coalesce((
      select jsonb_agg(distinct c.name order by c.name)
      from companies c
      where c.id in (
        select company_id from company_admins where user_id = v_uid
        union
        select s.company_id from studio_coordinators sc join studios s on s.id = sc.studio_id
        where sc.user_id = v_uid
        union
        select company_id from contracts where trainer_id = v_uid and status = 'active'
      )
    ), '[]'::jsonb)
  );
end;
$$;

-- Posteingang: Name und E-Mail der Absender:innen (nur für Plattform-Admins, nur Personen,
-- die tatsächlich eine Support-Nachricht geschickt haben).
create or replace function support_sender_details(p_user_ids uuid[])
returns table (id uuid, email text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'not_authorized';
  end if;
  return query
  select u.id, u.email::text, p.full_name
  from auth.users u
  left join profiles p on p.id = u.id
  where u.id = any(p_user_ids)
    and exists (select 1 from support_messages m where m.sender_id = u.id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 3. ONBOARDING
-- ─────────────────────────────────────────────────────────────────
alter table profiles
  add column onboarding_seen text[] not null default '{}';

create or replace function mark_onboarding_seen(p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;
  if p_role not in ('admin', 'coordinator', 'trainer', 'platform') then
    raise exception 'invalid_role';
  end if;
  update profiles
  set onboarding_seen = array(select distinct unnest(onboarding_seen || p_role))
  where id = auth.uid();
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RECHTE
-- ─────────────────────────────────────────────────────────────────
revoke insert, update, delete on support_recipients from authenticated;
revoke insert, update, delete on support_messages from authenticated;

revoke all on function
  add_support_recipient(text),
  remove_support_recipient(text),
  submit_support_message(text, text, text, jsonb, text),
  mark_onboarding_seen(text),
  support_sender_details(uuid[])
from public, anon;

grant execute on function add_support_recipient(text) to authenticated;
grant execute on function remove_support_recipient(text) to authenticated;
grant execute on function submit_support_message(text, text, text, jsonb, text) to authenticated;
grant execute on function mark_onboarding_seen(text) to authenticated;
grant execute on function support_sender_details(uuid[]) to authenticated;
