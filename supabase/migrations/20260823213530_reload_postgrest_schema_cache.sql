-- PostgREST cacht das Schema (Tabellen/Funktionen) und übernimmt neue
-- RPC-Funktionen nicht immer sofort. Erzwingt einen Reload.
notify pgrst, 'reload schema';
