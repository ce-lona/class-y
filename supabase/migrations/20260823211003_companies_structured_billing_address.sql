-- Strukturierte Rechnungsadresse statt Freitext (wird für Phase 2
-- Gutschriften/Belege gebraucht, siehe PLANNING.md Abschnitt 3/7).
alter table companies drop column billing_address;
alter table companies add column street text;
alter table companies add column house_number text;
alter table companies add column postal_code text;
alter table companies add column city text;
alter table companies add column country text not null default 'DE';
