REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reaction_counts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_reaction() FROM PUBLIC, anon, authenticated;