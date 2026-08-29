-- ---------------------------------------------------------------------------
-- Phase 1 (trust & safety), part 3: drop the world-readable phone column and
-- replace it with an audited reveal RPC.
-- ---------------------------------------------------------------------------

alter table public.profiles drop column if exists phone;

-- Audit trail: one row per successful reveal. No INSERT policy exists on this
-- table, so nothing client-side can write to it — only reveal_job_phone(),
-- which is SECURITY DEFINER and therefore bypasses RLS.
create table if not exists public.phone_reveals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  revealed_to uuid not null references public.profiles(id) on delete cascade,
  revealed_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists phone_reveals_job_id_idx on public.phone_reveals(job_id);
create index if not exists phone_reveals_revealed_to_idx on public.phone_reveals(revealed_to);

alter table public.phone_reveals enable row level security;

drop policy if exists "users can see their own reveals" on public.phone_reveals;
create policy "users can see their own reveals"
  on public.phone_reveals for select to authenticated
  using (revealed_to = auth.uid() or revealed_profile_id = auth.uid());

drop policy if exists "admins can see all reveals" on public.phone_reveals;
create policy "admins can see all reveals"
  on public.phone_reveals for select to authenticated
  using (public.current_user_is_admin());

-- The only path by which one user can obtain another user's phone number.
-- Verifies participation and job status server-side, records the reveal, then
-- returns the number.
create or replace function public.reveal_job_phone(p_job_id uuid)
returns table (full_name text, phone text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  actor uuid := auth.uid();
  j public.jobs%rowtype;
  counterparty uuid;
  found_phone text;
  found_name text;
begin
  if actor is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id;
  if not found then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if j.customer_id = actor then
    counterparty := j.accepted_pro_id;
  elsif j.accepted_pro_id = actor then
    counterparty := j.customer_id;
  else
    raise exception 'You are not a participant on this job.' using errcode = '42501';
  end if;

  if counterparty is null then
    raise exception 'This job has no accepted pro yet.' using errcode = '42501';
  end if;

  -- Contact details unlock once the job is actually under way, and stay
  -- available through completion and any appeal. Deliberately excludes
  -- 'open' (anyone can message) and 'cancelled' (no ongoing work).
  if j.status not in ('accepted', 'in_progress', 'completed', 'disputed') then
    raise exception 'Contact details are not available for a % job.', j.status
      using errcode = '42501';
  end if;

  select up.phone into found_phone from public.user_phones up where up.profile_id = counterparty;
  select p.full_name into found_name from public.profiles p where p.id = counterparty;

  if found_phone is null or btrim(found_phone) = '' then
    raise exception 'That user has not added a phone number.' using errcode = 'P0002';
  end if;

  insert into public.phone_reveals (job_id, revealed_to, revealed_profile_id)
  values (p_job_id, actor, counterparty);

  full_name := found_name;
  phone := found_phone;
  return next;
end;
$$;

revoke all on function public.reveal_job_phone(uuid) from public, anon;
grant execute on function public.reveal_job_phone(uuid) to authenticated;
