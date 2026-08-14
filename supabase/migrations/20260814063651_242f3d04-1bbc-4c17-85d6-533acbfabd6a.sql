revoke execute on function public.has_active_subscription(uuid, text) from anon, authenticated, public;
grant execute on function public.has_active_subscription(uuid, text) to service_role;