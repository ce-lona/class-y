-- E-Mail-Benachrichtigungen zu Gutschriften und Tätigkeitsnachweisen (2. Iteration).
--
-- Überblick
--   * company_billing_settings bekommt je Mail-Art einen Schalter (Standard: an). Nur
--     Company-Admins ändern ihn (bestehende Policies der Tabelle).
--   * Zusätzlich kann jede Person die Mail-Arten für sich selbst abbestellen (profiles.mail_*,
--     bestehende Policy "eigene Zeile bearbeiten"). Eine Mail entsteht nur, wenn beide an sind.
--   * billing_notifications ist eine Outbox: Trigger und der tägliche Job legen Zeilen an,
--     die Edge Function send-billing-notifications holt sie ab (billing_pending_notifications),
--     verschickt die Mails und quittiert sie (mark_billing_notification).
--       - document_ready:     neue Gutschrift / neuer Tätigkeitsnachweis → Trainer:in
--       - review_reminder:    letzter Tag der Prüffrist einer offenen Gutschrift → Trainer:in
--       - correction_request: Korrekturwunsch (Gutschrift) oder Kommentar (Nachweis)
--                             → Company-Admins + Koordinator:innen der betroffenen Studios,
--                               ohne die Person, die ihn geschrieben hat
--   * pg_cron ruft alle 10 Minuten die Edge Function auf (pg_net), sofern die Vault-Secrets
--     billing_notify_url und billing_notify_secret gesetzt sind. Ohne sie passiert nichts.
--   * In den Mails stehen keine IBAN- oder Steuerdaten.

-- ─────────────────────────────────────────────────────────────────
-- EINSTELLUNGEN
-- ─────────────────────────────────────────────────────────────────

alter table company_billing_settings
  add column notify_document_ready     boolean not null default true,
  add column notify_review_reminder    boolean not null default true,
  add column notify_correction_request boolean not null default true;

-- Standardwerte für Companies ohne gespeicherte Einstellungen (Spaltenreihenfolge der Tabelle).
create or replace function billing_settings_for(p_company_id uuid)
returns company_billing_settings language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s from company_billing_settings s where s.company_id = p_company_id),
    row(p_company_id, 'manual', 1, 3, false, false, 10, 'GS', now(), true, true, true)::company_billing_settings
  );
$$;

drop function if exists get_company_billing_settings(uuid);
create function get_company_billing_settings(target_company_id uuid)
returns table (
  company_id uuid,
  mode text,
  run_day smallint,
  review_days smallint,
  split_by_studio boolean,
  employee_statements boolean,
  payment_days smallint,
  number_prefix text,
  notify_document_ready boolean,
  notify_review_reminder boolean,
  notify_correction_request boolean,
  billing_address_complete boolean,
  can_edit boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_admin boolean := is_platform_admin() or is_company_admin(target_company_id);
begin
  if not (v_admin or is_company_coordinator(target_company_id)) then
    raise exception 'not_authorized';
  end if;

  return query
    select s.company_id, s.mode, s.run_day, s.review_days, s.split_by_studio,
           s.employee_statements, s.payment_days, s.number_prefix,
           s.notify_document_ready, s.notify_review_reminder, s.notify_correction_request,
           billing_address_complete(target_company_id), v_admin
    from billing_settings_for(target_company_id) s;
end;
$$;

revoke all on function get_company_billing_settings(uuid) from public, anon;
grant execute on function get_company_billing_settings(uuid) to authenticated, service_role;

-- Persönliche Abbestellung je Mail-Art.
alter table profiles
  add column mail_document_ready     boolean not null default true,
  add column mail_review_reminder    boolean not null default true,
  add column mail_correction_request boolean not null default true;

-- ─────────────────────────────────────────────────────────────────
-- OUTBOX
-- ─────────────────────────────────────────────────────────────────

create table billing_notifications (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  document_id  uuid not null references billing_documents(id) on delete cascade,
  comment_id   uuid references billing_comments(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  kind         text not null check (kind in ('document_ready', 'review_reminder', 'correction_request')),
  created_at   timestamptz not null default now(),
  -- gesetzt, während die Edge Function die Zeile verarbeitet (verhindert doppelten Versand)
  claimed_at   timestamptz,
  sent_at      timestamptz,
  attempts     integer not null default 0,
  last_error   text,

  constraint billing_notifications_comment_kind
    check ((kind = 'correction_request') = (comment_id is not null))
);

create unique index billing_notifications_document_once
  on billing_notifications (document_id, kind, recipient_id) where comment_id is null;
create unique index billing_notifications_comment_once
  on billing_notifications (comment_id, recipient_id) where comment_id is not null;
create index billing_notifications_pending_idx
  on billing_notifications (created_at) where sent_at is null;
create index billing_notifications_recipient_idx on billing_notifications (recipient_id);

alter table billing_notifications enable row level security;

create policy "billing_notifications: platform_admin liest"
  on billing_notifications for select
  using (is_platform_admin());

revoke all on billing_notifications from anon, authenticated;
grant select on billing_notifications to authenticated;
-- In Produktion hat service_role keine Standardrechte auf neue Tabellen.
grant select on billing_notifications to service_role;

-- ─────────────────────────────────────────────────────────────────
-- EINREIHEN
-- ─────────────────────────────────────────────────────────────────

-- Nur aktive (nicht gelöschte/anonymisierte) Konten, die die Mail-Art nicht abbestellt haben.
create or replace function billing_notify_recipient_ok(p_user_id uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_user_id
      and p.deleted_at is null
      and case p_kind
            when 'document_ready' then p.mail_document_ready
            when 'review_reminder' then p.mail_review_reminder
            when 'correction_request' then p.mail_correction_request
            else false
          end
  );
$$;

-- a) Neuer Beleg (Gutschrift oder Tätigkeitsnachweis) → Trainer:in.
create or replace function enqueue_billing_document_ready()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('credit_note', 'statement')
     and (billing_settings_for(new.company_id)).notify_document_ready
     and billing_notify_recipient_ok(new.trainer_id, 'document_ready') then
    insert into billing_notifications (company_id, document_id, recipient_id, kind)
    values (new.company_id, new.id, new.trainer_id, 'document_ready')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger billing_documents_notify_ready
  after insert on billing_documents
  for each row execute function enqueue_billing_document_ready();

-- b) Korrekturwunsch / Kommentar → Company-Admins + Koordinator:innen der betroffenen Studios.
create or replace function enqueue_billing_correction_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_doc billing_documents%rowtype;
begin
  select * into v_doc from billing_documents where id = new.document_id;
  if not found or not (billing_settings_for(v_doc.company_id)).notify_correction_request then
    return new;
  end if;

  insert into billing_notifications (company_id, document_id, comment_id, recipient_id, kind)
  select v_doc.company_id, v_doc.id, new.id, r.user_id, 'correction_request'
  from (
    select ca.user_id
    from company_admins ca
    where ca.company_id = v_doc.company_id
    union
    select sc.user_id
    from studio_coordinators sc
    join studios s on s.id = sc.studio_id and s.company_id = v_doc.company_id
    where sc.studio_id = v_doc.studio_id
       or (v_doc.studio_id is null and sc.studio_id in (
             select (l ->> 'studio_id')::uuid
             from jsonb_array_elements(v_doc.snapshot -> 'lines') l))
  ) r
  where r.user_id is distinct from new.author_id
    and billing_notify_recipient_ok(r.user_id, 'correction_request')
  on conflict do nothing;

  return new;
end;
$$;

create trigger billing_comments_notify
  after insert on billing_comments
  for each row execute function enqueue_billing_correction_request();

-- c) Erinnerung am letzten Prüftag: im täglichen Job (sonst unverändert).
create or replace function billing_run_daily(p_today date default current_date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auto integer;
  v_runs integer := 0;
  v_failed integer := 0;
  v_reminders integer;
  r record;
  v_month date := (date_trunc('month', p_today) - interval '1 month')::date;
begin
  update billing_documents
  set status = 'auto_approved'
  where kind = 'credit_note' and status = 'open' and review_due < p_today;
  get diagnostics v_auto = row_count;

  insert into billing_notifications (company_id, document_id, recipient_id, kind)
  select d.company_id, d.id, d.trainer_id, 'review_reminder'
  from billing_documents d
  where d.kind = 'credit_note'
    and d.status = 'open'
    and d.review_due = p_today
    and (billing_settings_for(d.company_id)).notify_review_reminder
    and billing_notify_recipient_ok(d.trainer_id, 'review_reminder')
  on conflict do nothing;
  get diagnostics v_reminders = row_count;

  for r in
    select s.company_id, s.split_by_studio, st.id as studio_id
    from company_billing_settings s
    left join studios st on s.split_by_studio and st.company_id = s.company_id
    where s.mode = 'scheduled'
      and s.run_day = extract(day from p_today)::integer
      and (not s.split_by_studio or st.id is not null)
  loop
    begin
      perform billing_issue_internal(r.company_id, v_month, r.studio_id, null);
      v_runs := v_runs + 1;
    exception when others then
      -- z. B. fehlende Rechnungsanschrift: die Company sieht den Fehler im Tab.
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object('auto_approved', v_auto, 'runs', v_runs, 'failed', v_failed,
                            'reminders', v_reminders);
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- VERSAND (nur service_role / Edge Function)
-- ─────────────────────────────────────────────────────────────────

-- Holt bis zu p_limit fällige Mails und reserviert sie für 15 Minuten. Hinfällige Mails
-- (Beleg storniert/ersetzt, Gutschrift nicht mehr offen, Konto gelöscht, inzwischen
-- abbestellt) werden ohne Versand
-- abgeschlossen. Nach 5 Fehlversuchen oder 7 Tagen wird nicht mehr versucht.
create or replace function billing_pending_notifications(p_limit integer default 50)
returns table (
  id uuid,
  kind text,
  recipient_email text,
  recipient_name text,
  company_name text,
  document_kind text,
  document_number text,
  document_version integer,
  replaces_number text,
  month date,
  review_due date,
  comment_kind text,
  comment_body text,
  comment_author_name text,
  trainer_name text
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  update billing_notifications n
  set sent_at = now(), last_error = 'obsolete'
  from billing_documents d
  where d.id = n.document_id
    and n.sent_at is null
    and (
      d.status in ('cancelled', 'superseded')
      or (n.kind = 'review_reminder' and d.status <> 'open')
      or not billing_notify_recipient_ok(n.recipient_id, n.kind)
      or not exists (select 1 from auth.users u where u.id = n.recipient_id and u.email is not null)
    );

  return query
  with picked as (
    select n.id
    from billing_notifications n
    where n.sent_at is null
      and n.attempts < 5
      and n.created_at > now() - interval '7 days'
      and (n.claimed_at is null or n.claimed_at < now() - interval '15 minutes')
    order by n.created_at
    limit greatest(coalesce(p_limit, 50), 0)
    for update skip locked
  ),
  claimed as (
    update billing_notifications n
    set claimed_at = now()
    from picked
    where n.id = picked.id
    returning n.*
  )
  select c.id, c.kind, u.email::text, p.full_name, co.name,
         d.kind, d.number, d.version,
         d.snapshot -> 'replaces' ->> 'number',
         d.month, d.review_due,
         bc.kind, bc.body, ap.full_name,
         d.snapshot -> 'recipient' ->> 'name'
  from claimed c
  join billing_documents d on d.id = c.document_id
  join companies co on co.id = c.company_id
  join auth.users u on u.id = c.recipient_id
  left join profiles p on p.id = c.recipient_id
  left join billing_comments bc on bc.id = c.comment_id
  left join profiles ap on ap.id = bc.author_id
  order by c.created_at;
end;
$$;

-- Quittung der Edge Function: ohne Fehler → versendet; mit Fehler → neuer Versuch beim
-- nächsten Lauf (höchstens 5 Versuche).
create or replace function mark_billing_notification(p_id uuid, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_error is null then
    update billing_notifications
    set sent_at = now(), claimed_at = null, last_error = null, attempts = attempts + 1
    where id = p_id and sent_at is null;
  else
    update billing_notifications
    set claimed_at = null, attempts = attempts + 1, last_error = left(p_error, 1000)
    where id = p_id and sent_at is null;
  end if;
end;
$$;

-- Aufruf der Edge Function durch pg_cron. Läuft nur, wenn pg_net installiert ist und beide
-- Vault-Secrets existieren; sonst passiert nichts (lokal, CI, Produktion ohne Einrichtung).
create or replace function billing_notify_dispatch()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return false;
  end if;

  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'billing_notify_url' limit 1$q$
    into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'billing_notify_secret' limit 1$q$
    into v_secret;
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return false;
  end if;

  -- Nichts zu tun → keinen Aufruf auslösen.
  if not exists (
    select 1 from billing_notifications
    where sent_at is null and attempts < 5 and created_at > now() - interval '7 days'
  ) then
    return false;
  end if;

  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 60000)'
    using v_url,
          jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
          '{}'::jsonb;
  return true;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- DSGVO: ausstehende Mails einer gelöschten Person entfallen
-- ─────────────────────────────────────────────────────────────────

create or replace function gdpr_scrub_profile(p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  -- Offene und künftige Vertretungen mit der Person sind hinfällig.
  update substitute_assignments
  set status = 'cancelled', responded_at = coalesce(responded_at, now())
  where p_user_id in (original_trainer_id, substitute_trainer_id)
    and (status = 'pending' or (status = 'accepted' and date >= current_date));

  -- Nie wirksam gewordene Angebote haben keine Aufbewahrungspflicht.
  delete from contracts where trainer_id = p_user_id and status in ('pending', 'declined');

  -- Laufende Contracts enden mit dem heutigen Tag (frühestens zum Vertragsbeginn).
  update contracts
  set status = 'ended',
      valid_to = greatest(valid_from, least(coalesce(valid_to, current_date), current_date))
  where trainer_id = p_user_id and status = 'active';

  delete from company_admins where user_id = p_user_id;
  delete from studio_coordinators where user_id = p_user_id;
  delete from platform_admins where user_id = p_user_id;
  -- IBAN/Steuernummer: auf ausgestellten Belegen (Kopie) bleiben sie erhalten.
  delete from trainer_billing_details where user_id = p_user_id;
  -- Mail-Outbox: Benachrichtigungen an die Person (offen wie versendet) haben keinen Zweck mehr.
  delete from billing_notifications where recipient_id = p_user_id;

  if gdpr_user_has_retained_records(p_user_id) then
    update profiles
    set full_name = 'Gelöschtes Konto',
        phone = null,
        street = null,
        house_number = null,
        postal_code = null,
        city = null,
        deleted_at = coalesce(deleted_at, now())
    where id = p_user_id;
    return 'anonymized';
  end if;

  delete from profiles where id = p_user_id;
  return 'deleted';
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RECHTE
-- ─────────────────────────────────────────────────────────────────

revoke all on function
  billing_settings_for(uuid),
  billing_notify_recipient_ok(uuid, text),
  enqueue_billing_document_ready(),
  enqueue_billing_correction_request(),
  billing_run_daily(date),
  billing_pending_notifications(integer),
  mark_billing_notification(uuid, text),
  billing_notify_dispatch(),
  gdpr_scrub_profile(uuid)
from public, anon, authenticated;

grant execute on function
  billing_run_daily(date),
  billing_pending_notifications(integer),
  mark_billing_notification(uuid, text)
to service_role;

-- ─────────────────────────────────────────────────────────────────
-- JOB: alle 10 Minuten Mails verschicken (pg_cron + pg_net, falls verfügbar)
-- ─────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      create extension if not exists pg_net with schema extensions;
    else
      create extension if not exists pg_net;
    end if;
  end if;

  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'billing-notifications',
      '*/10 * * * *',
      'select public.billing_notify_dispatch()'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
