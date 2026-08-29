import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// `supabase` is a global exposed by the UMD build loaded in index.html.
export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------------- Auth ----------------
export async function signUp(email, password, fullName) {
  return unwrap(
    await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
  );
}

export async function signIn(email, password) {
  return unwrap(await sb.auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// ---------------- Profiles ----------------
export async function getProfile(id) {
  return unwrap(await sb.from("profiles").select("*").eq("id", id).maybeSingle());
}

export async function getProDetails(profileId) {
  return unwrap(
    await sb.from("pro_details").select("*").eq("profile_id", profileId).maybeSingle()
  );
}

export async function getRatingStatsBulk(profileIds) {
  if (!profileIds.length) return [];
  return unwrap(
    await sb.from("profile_rating_stats").select("*").in("profile_id", profileIds)
  );
}

export async function getRatingStats(profileId) {
  return unwrap(
    await sb
      .from("profile_rating_stats")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle()
  );
}

export async function getRatingsFor(profileId) {
  return unwrap(
    await sb
      .from("ratings")
      .select("*, rater:profiles!rater_id(full_name, avatar_color)")
      .eq("ratee_id", profileId)
      .order("created_at", { ascending: false })
  );
}

export async function upsertProfile(id, patch) {
  return unwrap(
    await sb.from("profiles").update(patch).eq("id", id).select().maybeSingle()
  );
}

export async function upsertProDetails(profileId, patch) {
  return unwrap(
    await sb
      .from("pro_details")
      .upsert({ profile_id: profileId, ...patch }, { onConflict: "profile_id" })
      .select()
      .maybeSingle()
  );
}

export async function listNearbyPros({ excludeId } = {}) {
  let q = sb
    .from("profiles")
    .select("*, pro_details!inner(*)")
    .eq("is_pro", true)
    .eq("pro_details.is_available", true)
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (excludeId) q = q.neq("id", excludeId);
  return unwrap(await q);
}

// ---------------- Jobs ----------------
export async function createJob(payload) {
  return unwrap(await sb.from("jobs").insert(payload).select().single());
}

export async function listOpenJobs({ excludeCustomerId } = {}) {
  let q = sb
    .from("jobs")
    .select("*, customer:profiles!customer_id(full_name, avatar_color)")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (excludeCustomerId) q = q.neq("customer_id", excludeCustomerId);
  return unwrap(await q);
}

export async function listMyJobs(userId) {
  return unwrap(
    await sb
      .from("jobs")
      .select(
        "*, customer:profiles!customer_id(full_name, avatar_color), pro:profiles!accepted_pro_id(full_name, avatar_color)"
      )
      .or(`customer_id.eq.${userId},accepted_pro_id.eq.${userId}`)
      .order("updated_at", { ascending: false })
  );
}

export async function getJob(id) {
  return unwrap(
    await sb
      .from("jobs")
      .select(
        "*, customer:profiles!customer_id(id, full_name, avatar_color, phone), pro:profiles!accepted_pro_id(id, full_name, avatar_color, phone)"
      )
      .eq("id", id)
      .maybeSingle()
  );
}

export async function updateJob(id, patch) {
  return unwrap(await sb.from("jobs").update(patch).eq("id", id).select().maybeSingle());
}

// ---------------- Job threads (negotiation / chat per pro) ----------------
export async function getOrCreateThread(jobId, customerId, proId, offerAmount) {
  const existing = unwrap(
    await sb
      .from("job_threads")
      .select("*")
      .eq("job_id", jobId)
      .eq("pro_id", proId)
      .maybeSingle()
  );
  if (existing) return existing;
  return unwrap(
    await sb
      .from("job_threads")
      .insert({ job_id: jobId, customer_id: customerId, pro_id: proId, offer_amount: offerAmount })
      .select()
      .single()
  );
}

export async function listThreadsForJob(jobId) {
  return unwrap(
    await sb
      .from("job_threads")
      .select("*, pro:profiles!pro_id(full_name, avatar_color)")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
  );
}

export async function listMyThreadForJob(jobId, proId) {
  return unwrap(
    await sb.from("job_threads").select("*").eq("job_id", jobId).eq("pro_id", proId).maybeSingle()
  );
}

export async function updateThread(id, patch) {
  return unwrap(await sb.from("job_threads").update(patch).eq("id", id).select().maybeSingle());
}

// ---------------- Messages ----------------
export async function listMessages(threadId) {
  return unwrap(
    await sb
      .from("job_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
  );
}

export async function sendMessage(threadId, senderId, body) {
  return unwrap(
    await sb
      .from("job_messages")
      .insert({ thread_id: threadId, sender_id: senderId, body })
      .select()
      .single()
  );
}

export function subscribeToThread(threadId, onInsert) {
  const channel = sb
    .channel(`thread-${threadId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "job_messages", filter: `thread_id=eq.${threadId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => sb.removeChannel(channel);
}

// ---------------- Ratings ----------------
export async function submitRating(jobId, raterId, rateeId, stars, comment) {
  return unwrap(
    await sb
      .from("ratings")
      .insert({ job_id: jobId, rater_id: raterId, ratee_id: rateeId, stars, comment })
      .select()
      .single()
  );
}

export async function getRatingForJob(jobId, raterId) {
  return unwrap(
    await sb.from("ratings").select("*").eq("job_id", jobId).eq("rater_id", raterId).maybeSingle()
  );
}

// ---------------- Disputes ----------------
export async function fileDispute(jobId, filedBy, againstId, reason, details) {
  return unwrap(
    await sb
      .from("disputes")
      .insert({ job_id: jobId, filed_by: filedBy, against_id: againstId, reason, details })
      .select()
      .single()
  );
}

export async function listMyDisputes(userId) {
  return unwrap(
    await sb
      .from("disputes")
      .select("*, job:jobs!job_id(title)")
      .or(`filed_by.eq.${userId},against_id.eq.${userId}`)
      .order("created_at", { ascending: false })
  );
}

// ---------------- Admin ----------------
export async function listAllJobsAdmin() {
  return unwrap(
    await sb
      .from("jobs")
      .select("*, customer:profiles!customer_id(full_name), pro:profiles!accepted_pro_id(full_name)")
      .order("created_at", { ascending: false })
  );
}

export async function listAllDisputesAdmin() {
  return unwrap(
    await sb
      .from("disputes")
      .select(
        "*, job:jobs!job_id(title, status), filer:profiles!filed_by(full_name), against:profiles!against_id(full_name)"
      )
      .order("created_at", { ascending: false })
  );
}

export async function resolveDispute(id, status, resolutionNotes) {
  return unwrap(
    await sb
      .from("disputes")
      .update({ status, resolution_notes: resolutionNotes, resolved_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle()
  );
}

export async function listAllUsersAdmin() {
  return unwrap(
    await sb
      .from("profiles")
      .select("*, pro_details(*)")
      .order("created_at", { ascending: false })
  );
}

// ---------------- Storage (photos) ----------------
// Uploads a File to a public bucket under `${folder}/${timestamp}-${safeName}`
// and returns its public URL. Buckets are public-read; write access is
// scoped by RLS to the owning user (avatars/portfolio) or job participants
// (job-photos) — see the storage.objects policies applied via migration.
export async function uploadPublicFile(bucket, folder, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deletePublicFile(bucket, path) {
  const { error } = await sb.storage.from(bucket).remove([path]);
  if (error) throw error;
}

// ---------------- Portfolio (pro work photos) ----------------
export async function listProPhotos(profileId) {
  return unwrap(
    await sb
      .from("pro_photos")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
  );
}

export async function addProPhoto(profileId, url, caption) {
  return unwrap(
    await sb
      .from("pro_photos")
      .insert({ profile_id: profileId, url, caption: caption || null })
      .select()
      .single()
  );
}

export async function deleteProPhoto(id) {
  const { error } = await sb.from("pro_photos").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- Favorites (customers saving pros) ----------------
export async function listFavorites(customerId) {
  return unwrap(
    await sb
      .from("favorites")
      .select("*, pro:profiles!pro_id(*, pro_details(*))")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
  );
}

export async function addFavorite(customerId, proId) {
  return unwrap(
    await sb
      .from("favorites")
      .insert({ customer_id: customerId, pro_id: proId })
      .select()
      .single()
  );
}

export async function removeFavorite(customerId, proId) {
  const { error } = await sb
    .from("favorites")
    .delete()
    .eq("customer_id", customerId)
    .eq("pro_id", proId);
  if (error) throw error;
}
