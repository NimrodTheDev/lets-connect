-- ---------------------------------------------------------------------------
-- Phase 1 (trust & safety), part 2: move phone numbers off public.profiles.
--
-- public.profiles is world-readable to any authenticated user
-- ("profiles are viewable by authenticated users" USING (true)), so a phone
-- column on it was readable by every signed-in account regardless of what the
-- UI chose to render. Phone numbers move to their own table whose RLS only
-- admits the owner and admins; counterparties on a job get the number through
-- the logged reveal_job_phone() RPC instead (added in the next migration).
-- ---------------------------------------------------------------------------

create table if not exists public.user_phones (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_phones enable row level security;

drop policy if exists "users can read their own phone" on public.user_phones;
create policy "users can read their own phone"
  on public.user_phones for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "admins can read any phone" on public.user_phones;
create policy "admins can read any phone"
  on public.user_phones for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists "users can insert their own phone" on public.user_phones;
create policy "users can insert their own phone"
  on public.user_phones for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "users can update their own phone" on public.user_phones;
create policy "users can update their own phone"
  on public.user_phones for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "users can delete their own phone" on public.user_phones;
create policy "users can delete their own phone"
  on public.user_phones for delete to authenticated
  using (profile_id = auth.uid());

drop trigger if exists user_phones_set_updated_at on public.user_phones;
create trigger user_phones_set_updated_at
  before update on public.user_phones
  for each row execute function public.set_updated_at();

-- Carry existing numbers over before the old column is dropped.
insert into public.user_phones (profile_id, phone)
select id, btrim(phone)
from public.profiles
where phone is not null and btrim(phone) <> ''
on conflict (profile_id) do nothing;
