import { state } from "../state.js";
import { listMyJobs } from "../db.js";
import { escapeHtml, timeAgo, badgeHtml, toast, emptyState, loadingScreen } from "../ui.js";
import { navigate } from "../router.js";
import { JOB_STATUS_LABELS, formatCurrency } from "../config.js";

export async function renderMyJobs() {
  if (!state.user) return navigate("/login");

  document.getElementById("app").innerHTML = `
    <div class="container">
      <h2>My jobs</h2>
      <div id="myJobsBody">${loadingScreen("Loading your jobs…")}</div>
    </div>
  `;

  let jobs = [];
  try {
    jobs = await listMyJobs(state.user.id);
  } catch (err) {
    toast(err.message || "Could not load your jobs", "error");
  }

  const body = document.getElementById("myJobsBody");
  if (jobs.length === 0) {
    body.innerHTML = emptyState("🗂️", "No jobs yet", "Post a job or accept one from the job board to see it here.");
    return;
  }

  body.innerHTML = jobs
    .map((j) => {
      const iAmCustomer = j.customer_id === state.user.id;
      const other = iAmCustomer ? j.pro : j.customer;
      const roleLabel = iAmCustomer ? "You posted" : "You're the pro";
      return `
      <a href="#/job/${j.id}" class="card card-link">
        <div class="row" style="align-items:flex-start;">
          <div class="col">
            <div class="row" style="align-items:center;gap:8px;">
              <strong>${escapeHtml(j.title)}</strong>
              ${badgeHtml(j.status, JOB_STATUS_LABELS)}
            </div>
            <div class="tiny muted" style="margin-top:6px;">
              ${roleLabel}${other ? ` · with ${escapeHtml(other.full_name)}` : ""} · ${timeAgo(j.updated_at)}
            </div>
          </div>
          <div class="tiny" style="text-align:right;white-space:nowrap;">
            ${j.offer_amount ? `<strong>${formatCurrency(j.offer_amount)}</strong>` : ""}
          </div>
        </div>
      </a>`;
    })
    .join("");
}
