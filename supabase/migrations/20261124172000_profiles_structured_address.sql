-- Konsistent mit companies und studios: Adressen immer als Einzelfelder, kein Freitext.
alter table profiles drop column address;
alter table profiles add column street text;
alter table profiles add column house_number text;
alter table profiles add column postal_code text;
alter table profiles add column city text;
alter table profiles add column country text not null default 'DE';

notify pgrst, 'reload schema';
