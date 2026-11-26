-- Die Edge Function send-support-message liest die Empfänger und setzt den Versandstatus mit dem
-- Service-Role-Schlüssel. In Produktion bekommt service_role auf neue Tabellen keine Standardrechte,
-- daher hier explizit (nur das Nötigste).
grant select on support_recipients to service_role;
grant select, update (mail_status) on support_messages to service_role;
