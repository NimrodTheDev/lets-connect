-- A trigger function has no business being reachable at /rest/v1/rpc/.
-- (Calling it directly errors out anyway, but leaving EXECUTE granted trips
-- the Supabase security linter and widens the API surface for no reason.)
revoke all on function public.protect_privileged_profile_columns() from public, anon, authenticated;
