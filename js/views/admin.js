import { state, notifyStateChange } from "../state.js";
import {
  listAllJobsAdmin,
  listAllDisputesAdmin,
  resolveDispute,
  listAllUsersAdmin,
  createJob,
  upsertProfile,
  upsertProDetails,
  getProDetails,
} from "../db.js";
import { escapeHtml, timeAgo, badgeHtml, toast, loadingScreen, emptyState, avatarHtml } from "../ui.js";
import { navigate } from "../router.js";
import {
  JOB_STATUS_LABELS,
  DISPUTE_STATUS_LABELS,
  formatCurrency,
  DEFAULT_CENTER,
} from "../config.js";

let cache = { jobs: [], disputes: [], users: [] };
let activeTab = "disputes";

export async function renderAdmin() {
  if (!state.user) return navigate("/login");

  if (!state.profile?.is_admin) {
    document.getElementById("app").innerHTML = `
      <div class="container-narrow">
        <div class="empty-state">
          <div class="big">🔒</div>
          <strong>Admins only</strong>
          <div class="small">Your account doesn't have access to this page.</div>
        </div>
      </div>
    `;
    return;
  }
  // Note: this client-side check is a convenience, not the real gate. Every
  // admin-only query (listAllJobsAdmin, listAllDisputesAdmin,
  // listAllUsersAdmin, resolveDispute) is enforced by Postgres row-level
  // security policies keyed off profiles.is_admin, and is_admin itself
  // cannot be changed by a signed-in user — a database trigger silently
  // reverts any client attempt to flip it. So even a user who edited the
  // page's JS to skip this check would still be refused data by the
  // database itself.

  document.getElementById("app").innerHTML = `
    <div class="container">
      <h2>Admin dashboard</h2>
      <div id="adminStats" class="row wrap" style="gap:12px;margin-bottom:16px;">${loadingScreen("Loading stats…")}</div>
      <div class="tabs">
        <div class="tab" data-tab="disputes">Appeals</div>
        <div class="tab" data-tab="jobs">Jobs</div>
        <div class="tab" data-tab="users">Users</div>
        <div class="tab" data-tab="demo">Demo &amp; testing</div>
      </div>
      <div id="adminBody">${loadingScreen("Loading data…")}</div>
    </div>
  `;

  try {
    const [jobs, disputes, users] = await Promise.all([
      listAllJobsAdmin(),
      listAllDisputesAdmin(),
      listAllUsersAdmin(),
    ]);
    cache = { jobs, disputes, users };
  } catch (err) {
    toast(err.message || "Could not load admin data", "error");
    document.getElementById("adminBody").innerHTML = emptyState("⚠️", "Could not load admin data");
    return;
  }

  renderStats();
  wireTabs();
  activeTab = "disputes";
  renderActiveTab();
}

function renderStats() {
  const el = document.getElementById("adminStats");
  const openAppeals = cache.disputes.filter((d) => d.status === "open" || d.status === "under_review").length;
  const openJobs = cache.jobs.filter((j) => j.status === "open").length;
  const pros = cache.users.filter((u) => u.is_pro).length;
  const stat = (label, value) => `
    <div class="card card-tight" style="min-width:110px;flex:1;">
      <div class="tiny muted">${escapeHtml(label)}</div>
      <div style="font-size:1.6rem;font-weight:800;">${value}</div>
    </div>`;
  el.innerHTML =
    stat("Users", cache.users.length) +
    stat("Pros", pros) +
    stat("Jobs", cache.jobs.length) +
    stat("Open jobs", openJobs) +
    stat("Open appeals", openAppeals);
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((tabEl) => {
    tabEl.classList.toggle("active", tabEl.dataset.tab === activeTab);
    tabEl.addEventListener("click", () => {
      activeTab = tabEl.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tabEl));
      renderActiveTab();
    });
  });
}

function renderActiveTab() {
  if (activeTab === "disputes") renderDisputesTab();
  else if (activeTab === "jobs") renderJobsTab();
  else if (activeTab === "users") renderUsersTab();
  else renderDemoTab();
}

// ---------------- Appeals / disputes ----------------
function renderDisputesTab() {
  const body = document.getElementById("adminBody");
  if (cache.disputes.length === 0) {
    body.innerHTML = emptyState("🕊️", "No appeals filed", "Nothing to review right now.");
    return;
  }
  body.innerHTML = cache.disputes
    .map(
      (d) => `
    <div class="card" data-dispute="${d.id}">
      <div class="row" style="align-items:flex-start;">
        <div class="col">
          <div class="row" style="align-items:center;gap:8px;flex-wrap:wrap;">
            <strong>${escapeHtml(d.job?.title || "Job")}</strong>
            ${badgeHtml(d.status, DISPUTE_STATUS_LABELS)}
          </div>
          <div class="tiny muted" style="margin-top:4px;">
            ${escapeHtml(d.filer?.full_name || "Someone")} filed against ${escapeHtml(d.against?.full_name || "someone")} · ${timeAgo(d.created_at)}
          </div>
          <div class="small" style="margin-top:8px;"><strong>${escapeHtml(d.reason)}</strong></div>
          ${d.details ? `<p class="small muted" style="margin-top:4px;">${escapeHtml(d.details)}</p>` : ""}
          ${
            d.resolution_notes
              ? `<div class="small" style="margin-top:8px;background:#f5f6f8;border-radius:8px;padding:8px;"><strong>Resolution:</strong> ${escapeHtml(d.resolution_notes)}</div>`
              : ""
          }
        </div>
        <a href="#/job/${d.job_id}" class="btn btn-sm">View job</a>
      </div>
      ${
        d.status === "open" || d.status === "under_review"
          ? `
        <div class="row wrap" style="margin-top:12px;gap:8px;align-items:flex-end;">
          <div class="field" style="margin:0;flex:1;min-width:160px;">
            <label>Resolution notes</label>
            <textarea class="resolutionNotes" placeholder="What did you decide?" style="min-height:44px;"></textarea>
          </div>
          <div class="row" style="gap:6px;">
            <button class="btn btn-sm" data-action="under_review">Mark reviewing</button>
            <button class="btn btn-primary btn-sm" data-action="resolved">Resolve</button>
            <button class="btn btn-danger btn-sm" data-action="dismissed">Dismiss</button>
          </div>
        </div>`
          : ""
      }
    </div>`
    )
    .join("");

  body.querySelectorAll("[data-dispute]").forEach((card) => {
    const id = card.dataset.dispute;
    card.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const notesEl = card.querySelector(".resolutionNotes");
        btn.disabled = true;
        try {
          await resolveDispute(id, btn.dataset.action, notesEl ? notesEl.value.trim() : "");
          toast("Appeal updated.", "success");
          const idx = cache.disputes.findIndex((d) => d.id === id);
          if (idx >= 0) {
            cache.disputes[idx].status = btn.dataset.action;
            cache.disputes[idx].resolution_notes = notesEl ? notesEl.value.trim() : "";
          }
          renderStats();
          renderDisputesTab();
        } catch (err) {
          toast(err.message || "Could not update appeal", "error");
          btn.disabled = false;
        }
      });
    });
  });
}

// ---------------- Jobs ----------------
function renderJobsTab() {
  const body = document.getElementById("adminBody");
  if (cache.jobs.length === 0) {
    body.innerHTML = emptyState("🗂️", "No jobs yet");
    return;
  }
  body.innerHTML = cache.jobs
    .map(
      (j) => `
    <a href="#/job/${j.id}" class="card card-link">
      <div class="row" style="align-items:flex-start;">
        <div class="col">
          <div class="row" style="align-items:center;gap:8px;flex-wrap:wrap;">
            <strong>${escapeHtml(j.title)}</strong>
            ${badgeHtml(j.status, JOB_STATUS_LABELS)}
          </div>
          <div class="tiny muted" style="margin-top:4px;">
            ${escapeHtml(j.customer?.full_name || "—")}${j.pro ? ` → ${escapeHtml(j.pro.full_name)}` : ""} · ${timeAgo(j.created_at)}
          </div>
        </div>
        <div class="tiny" style="text-align:right;white-space:nowrap;">
          ${j.offer_amount ? `<strong>${formatCurrency(j.offer_amount)}</strong>` : ""}
        </div>
      </div>
    </a>`
    )
    .join("");
}

// ---------------- Users ----------------
function renderUsersTab() {
  const body = document.getElementById("adminBody");
  if (cache.users.length === 0) {
    body.innerHTML = emptyState("👥", "No users yet");
    return;
  }
  body.innerHTML = cache.users
    .map(
      (u) => `
    <a href="#/profile/${u.id}" class="card card-link">
      <div class="row" style="align-items:center;gap:12px;">
        ${avatarHtml(u.full_name, u.avatar_color, "avatar-sm", u.avatar_url)}
        <div class="col">
          <div class="row" style="align-items:center;gap:8px;">
            <strong>${escapeHtml(u.full_name || "Unnamed")}</strong>
            ${u.is_pro ? `<span class="badge badge-open">Pro</span>` : ""}
            ${u.is_admin ? `<span class="badge badge-accepted">Admin</span>` : ""}
          </div>
          <div class="tiny muted" style="margin-top:2px;">
            ${u.phone ? escapeHtml(u.phone) + " · " : ""}joined ${timeAgo(u.created_at)}
          </div>
        </div>
        ${u.pro_details?.rate_amount ? `<div class="tiny"><strong>${formatCurrency(u.pro_details.rate_amount)}</strong></div>` : ""}
      </div>
    </a>`
    )
    .join("");
}

// ---------------- Demo & testing ----------------
const DEMO_JOB_TEMPLATES = [
  {
    title: "[Demo] Fix leaking kitchen sink",
    description: "Sample job seeded for testing — the pipe under the sink drips when the tap runs.",
    category: "Plumbing",
    offer_amount: 8000,
    offer_unit: "job",
  },
  {
    title: "[Demo] Weekly house cleaning",
    description: "Sample job seeded for testing — 3-bedroom apartment, weekly cleaning needed.",
    category: "Cleaning / Maid Service",
    offer_amount: 6000,
    offer_unit: "job",
  },
  {
    title: "[Demo] Birthday dinner for 6",
    description: "Sample job seeded for testing — private chef wanted for a Saturday evening dinner.",
    category: "Private Chef / Cooking",
    offer_amount: 25000,
    offer_unit: "job",
  },
];

function renderDemoTab() {
  const body = document.getElementById("adminBody");
  const isPro = !!state.profile?.is_pro;
  const links = [
    ["#/", "Landing page"],
    ["#/map", "Map view"],
    ["#/jobs", "Job board"],
    ["#/post-job", "Post a job"],
    ["#/my-jobs", "My jobs"],
    ["#/favorites", "Favorites"],
    ["#/profile/me/edit", "Edit my profile"],
    [`#/profile/${state.user.id}`, "View my public profile"],
  ];

  body.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <strong>Private to admins</strong>
      <p class="small muted" style="margin-top:4px;">
        This whole Admin tab — including this Demo &amp; testing panel — only
        renders for accounts with <code>is_admin = true</code> on their
        profile, and every query it makes is separately enforced by database
        row-level security. Right now that's just your account
        (${escapeHtml(state.profile?.full_name || "you")}). Nobody can grant
        themselves admin from the app — the database rejects that column
        change no matter what the client sends.
      </p>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <strong>Quick navigation</strong>
      <p class="small muted" style="margin-top:4px;">Jump straight to any screen to click through it.</p>
      <div class="row wrap" style="gap:8px;margin-top:10px;">
        ${links.map(([href, label]) => `<a href="${href}" class="btn btn-sm">${escapeHtml(label)}</a>`).join("")}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <strong>Sample job postings</strong>
      <p class="small muted" style="margin-top:4px;">
        Seed a few realistic "[Demo]" jobs (posted under your own account) so
        the job board, map, and job-detail flows have something to test
        against.
      </p>
      <button id="seedJobsBtn" class="btn btn-primary btn-sm" style="margin-top:8px;">Seed 3 demo jobs</button>
    </div>

    <div class="card">
      <strong>Test as a pro</strong>
      <p class="small muted" style="margin-top:4px;">
        Toggle your own account's pro status to see the app the way a
        handyman/chef/etc. would — post an offer, appear on the map, receive
        job threads. Toggle it back off any time.
      </p>
      <div class="row" style="align-items:center;gap:10px;margin-top:8px;">
        <span class="tiny muted">Currently: <strong>${isPro ? "Pro mode" : "Customer mode"}</strong></span>
        <button id="toggleProBtn" class="btn btn-sm">${isPro ? "Switch to customer mode" : "Switch to pro mode"}</button>
      </div>
    </div>
  `;

  document.getElementById("seedJobsBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Seeding…";
    try {
      for (let i = 0; i < DEMO_JOB_TEMPLATES.length; i++) {
        const tmpl = DEMO_JOB_TEMPLATES[i];
        await createJob({
          customer_id: state.user.id,
          title: tmpl.title,
          description: tmpl.description,
          category: tmpl.category,
          offer_amount: tmpl.offer_amount,
          offer_unit: tmpl.offer_unit,
          offer_negotiable: true,
          // Spread the demo pins out a little around the default map center
          // so they don't all stack on one spot.
          lat: DEFAULT_CENTER.lat + (Math.random() - 0.5) * 0.05,
          lng: DEFAULT_CENTER.lng + (Math.random() - 0.5) * 0.05,
          location_label: "Demo location",
          status: "open",
        });
      }
      toast("Seeded 3 demo jobs — check the Job board or Map.", "success");
    } catch (err) {
      toast(err.message || "Could not seed demo jobs", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Seed 3 demo jobs";
    }
  });

  document.getElementById("toggleProBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const nextIsPro = !state.profile.is_pro;
      const updated = await upsertProfile(state.user.id, { is_pro: nextIsPro });
      state.profile = updated;
      if (nextIsPro) {
        const existing = await getProDetails(state.user.id);
        if (!existing) {
          await upsertProDetails(state.user.id, {
            headline: "[Demo] Test pro profile",
            bio: "Seeded automatically so you can test the pro experience.",
            services: ["General Handyman"],
            rate_amount: 5000,
            rate_unit: "hour",
            rate_negotiable: true,
            is_available: true,
          });
        }
      }
      notifyStateChange();
      toast(nextIsPro ? "You're now in pro mode." : "You're back in customer mode.", "success");
      renderDemoTab();
    } catch (err) {
      toast(err.message || "Could not switch mode", "error");
      btn.disabled = false;
    }
  });
}
