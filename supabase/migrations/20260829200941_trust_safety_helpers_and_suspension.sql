-- ---------------------------------------------------------------------------
-- Phase 1 (trust & safety), part 1: privilege helpers + account suspension.
-- ---------------------------------------------------------------------------

-- Suspension state lives on profiles alongside is_admin.
alter table public.profiles
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

-- SECURITY DEFINER helpers so policies can ask "is the caller an admin /
-- suspended?" without re-entering the RLS policies on profiles (a policy on
-- profiles that itself selects from profiles would recurse).
create or replace function public.current_user_is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false);
$$;

create or replace function public.current_user_is_suspended(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select p.is_suspended from public.profiles p where p.id = uid), false);
$$;

revoke all on function public.current_user_is_admin(uuid) from public, anon;
revoke all on function public.current_user_is_suspended(uuid) from public, anon;
grant execute on function public.current_user_is_admin(uuid) to authenticated;
grant execute on function public.current_user_is_suspended(uuid) to authenticated;

-- Replaces protect_is_admin_column(): same "silently revert client writes"
-- pattern, now covering the suspension columns too.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := public.current_user_is_admin(auth.uid());
begin
  -- is_admin can never be changed through the API by anyone, admins
  -- included. Granting admin stays a direct-database operation (disable this
  -- trigger, update, re-enable).
  if NEW.is_admin is distinct from OLD.is_admin then
    NEW.is_admin := OLD.is_admin;
  end if;

  -- Suspending someone IS an in-app admin action, so admins may write these.
  -- actor is null for direct database / service-role access, which stays
  -- allowed. Everyone else silently keeps the old values.
  if not (actor_is_admin or actor is null) then
    NEW.is_suspended := OLD.is_suspended;
    NEW.suspended_at := OLD.suspended_at;
    NEW.suspended_reason := OLD.suspended_reason;
  end if;

  return NEW;
end;
$$;

drop trigger if exists protect_is_admin_column_trigger on public.profiles;
drop function if exists public.protect_is_admin_column();

create trigger protect_privileged_profile_columns_trigger
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();

-- Admins need to write to other people's profile rows to suspend them; the
-- trigger above still stops them (or anyone) from granting admin.
drop policy if exists "admins can update any profile" on public.profiles;
create policy "admins can update any profile"
  on public.profiles for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
