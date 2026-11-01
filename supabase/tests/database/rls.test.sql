-- pgTAP-Test, ausführbar mit `supabase test db`.
begin;
select plan(2);

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'jede Tabelle in public hat Row Level Security aktiviert'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  0::bigint,
  'keine security-definer-Funktion in public ist für anon ausführbar'
);

select * from finish();
rollback;
