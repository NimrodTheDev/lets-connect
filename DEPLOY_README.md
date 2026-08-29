# At Your Service — deploy package

This zip is the complete, current site: the "At Your Service" rebrand, photo
uploads (avatars, portfolios, job photos), the expanded 27-category service
list with a custom "Other" field, Favorites, job-board keyword search, full
PWA installability (manifest + service worker + icons), and the new
Admin → "Demo & testing" tab.

## How to get this live (GitHub → Vercel, since the repo is already connected)

1. Unzip this into your local `handyhail` repo, overwriting existing files.
2. From the repo root:
   ```
   git add -A
   git commit -m "At Your Service: rebrand, photos, favorites, PWA, admin demo mode"
   git push
   ```
3. Vercel will pick up the push on the connected repo and deploy automatically
   (no build step needed — it's a static site). Watch the deploy in the
   Vercel dashboard; once it says Ready, the production URL is live.

No environment variables need to be set — `js/config.js` already has the
Supabase URL and public anon key baked in (safe to ship client-side; access
is enforced by Postgres row-level security, not by hiding the key).

## What changed since the last working deploy

- Rebrand to "At Your Service" (name, tagline, manifest, service worker
  cache name).
- Photo uploads: profile avatars, pro portfolios, and job photos, all via
  Supabase Storage buckets (`avatars`, `portfolio`, `job-photos`).
- Service categories expanded from "handyman only" to 27 categories
  (cleaning, chefs, barbers, tutors, masseuses, etc.) plus a free-text
  "Other" / custom category field on both job posts and pro profiles.
- New Favorites feature (customers can save pros, `#/favorites`).
- Job board keyword search box, on top of the existing category/radius
  filters.
- Full PWA installability: `manifest.json`, `service-worker.js`
  (app-shell cache-first), and a real icon set (192/512/maskable/apple-touch).
- Admin dashboard gets a new "Demo & testing" tab (admin-only, see below):
  quick links to every screen, a "seed 3 demo jobs" button, and a
  customer/pro mode toggle for your own account so you can test both sides
  of the marketplace without a second account.

## Admin access — confirmed admin-only

Only your account (`midas30070@gmail.com`) has `is_admin = true` in the
`profiles` table. The admin route (`#/admin`) is hidden client-side for
everyone else, but the real enforcement is server-side: every admin query
(`listAllJobsAdmin`, `listAllDisputesAdmin`, `listAllUsersAdmin`,
`resolveDispute`) is gated by Postgres row-level security policies that
check `profiles.is_admin` for the *signed-in* user, not anything the client
claims.

I also closed a gap that existed before this change: the profiles table's
"update your own profile" RLS policy only checked *row ownership*, not which
*columns* changed — so, in principle, any signed-in user could have called
the Supabase client directly and set their own `is_admin` to `true`. I added
a database trigger (`protect_is_admin_column_trigger`) that silently reverts
any client-side change to `is_admin`, so that column can now only be changed
via direct database access (e.g. me running SQL), never from the app or a
hand-crafted API call. So yes — the admin tab, and everything behind it, is
only available to you.
