-- ---------------------------------------------------------------------------
-- Phase 1 (trust & safety), part 4: suspended accounts lose write access at
-- the database level, and admins gain the moderation reach they need.
-- ---------------------------------------------------------------------------

-- Suspension is enforced here, in RLS, not by hiding buttons: a suspended
-- user driving the Supabase client directly is refused all the same.
drop policy if exists "customers can create jobs" on public.jobs;
create policy "customers can create jobs"
  on public.jobs for insert to authenticated
  with check (customer_id = auth.uid() and not public.current_user_is_suspended());

drop policy if exists "pro can start a thread on a job" on public.job_threads;
create policy "pro can start a thread on a job"
  on public.job_threads for insert to authenticated
  with check (pro_id = auth.uid() and not public.current_user_is_suspended());

drop policy if exists "participants can send thread messages" on public.job_messages;
create policy "participants can send thread messages"
  on public.job_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and not public.current_user_is_suspended()
    and exists (
      select 1 from public.job_threads t
      where t.id = job_messages.thread_id
        and (t.customer_id = auth.uid() or t.pro_id = auth.uid())
    )
  );

drop policy if exists "pro_photos_insert_own" on public.pro_photos;
create policy "pro_photos_insert_own"
  on public.pro_photos for insert to authenticated
  with check (profile_id = auth.uid() and not public.current_user_is_suspended());

-- Moderation reach: take down an inappropriate portfolio photo, or edit a
-- job (in practice, strip a photo out of jobs.photo_urls).
drop policy if exists "admins can delete any pro photo" on public.pro_photos;
create policy "admins can delete any pro photo"
  on public.pro_photos for delete to authenticated
  using (public.current_user_is_admin());

drop policy if exists "admins can update any job" on public.jobs;
create policy "admins can update any job"
  on public.jobs for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
