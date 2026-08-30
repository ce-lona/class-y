-- Direkter RPC-Aufruf (statt nur intern in Policies) für neue Edge Functions,
-- die den Aufrufer selbst auf platform_admin prüfen müssen.
grant execute on function is_platform_admin() to authenticated;
