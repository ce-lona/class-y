-- Konsistent mit companies: Adressen immer als Einzelfelder, kein Freitext.
alter table studios drop column address;
alter table studios add column street text;
alter table studios add column house_number text;
alter table studios add column postal_code text;
alter table studios add column city text;
alter table studios add column country text not null default 'DE';
