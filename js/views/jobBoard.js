import { state } from "../state.js";
import { listOpenJobs } from "../db.js";
import { ensureLocation } from "../session.js";
import { haversineKm, formatDistance } from "../geo.js";
import { escapeHtml, timeAgo, toast, emptyState, loadingScreen } from "../ui.js";
import { navigate } from "../router.js";
import { createMap, pinIcon, meIcon } from "../leafletHelpers.js";
import { RADIUS_OPTIONS_KM, SERVICE_CATEGORIES, formatCurrency } from "../config.js";

let viewMode = "list";

export async function renderJobBoard() {
  if (!state.user) return navigate("/login");

  document.getElementById("app").innerHTML = `
    <div class="container">
      <div class="row wrap" style="align-items:center;margin-bottom:12px;gap:10px;">
        <h2 style="margin:0;">Job board</h2>
        <span class="spacer"></span>
        <input type="text" id="searchInput" placeholder="🔎 Search jobs…" style="max-width:180px;" />
        <select id="categoryFilter">
          <option value="">All categories</option>
          ${SERVICE_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
        </select>
        <select id="radiusSelect">
          ${RADIUS_OPTIONS_KM.map(
            (r) => `<option value="${r}" ${r === state.radiusKm ? "selected" : ""}>${r} km</option>`
          ).join("")}
        </select>
        <div class="row" style="gap:0;">
          <button class="btn btn-sm" id="listModeBtn">List</button>
          <button class="btn btn-sm" id="mapModeBtn">Map</button>
        </div>
      </div>
      <div id="boardBody">${loadingScreen("Loading open jobs…")}</div>
    </div>
  `;

  const location = await ensureLocation();

  document.getElementById("listModeBtn").addEventListener("click", () => {
    viewMode = "list";
    applyFilters();
  });
  document.getElementById("mapModeBtn").addEventListener("click", () => {
    viewMode = "map";
    applyFilters();
  });
  document.getElementById("categoryFilter").addEventListener("change", applyFilters);
  document.getElementById("radiusSelect").addEventListener("change", (e) => {
    state.radiusKm = Number(e.target.value);
    applyFilters();
  });
  document.getElementById("searchInput").addEventListener("input", applyFilters);

  let jobs = [];
  try {
    jobs = await listOpenJobs({ excludeCustomerId: state.user.id });
  } catch (err) {
    toast(err.message || "Could not load jobs", "error");
  }

  function withDistance(list) {
    return list
      .map((j) => ({ ...j, distanceKm: location ? haversineKm(location.lat, location.lng, j.lat, j.lng) : null }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  const allWithDistance = withDistance(jobs);

  function applyFilters() {
    const cat = document.getElementById("categoryFilter").value;
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    let filtered = allWithDistance.filter((j) => (location ? j.distanceKm <= state.radiusKm : true));
    if (cat) filtered = filtered.filter((j) => j.category === cat);
    if (q) {
      filtered = filtered.filter((j) =>
        [j.title, j.description, j.category, j.custom_category].some((f) => (f || "").toLowerCase().includes(q))
      );
    }
    document.getElementById("listModeBtn").classList.toggle("btn-dark", viewMode === "list");
    document.getElementById("mapModeBtn").classList.toggle("btn-dark", viewMode === "map");
    if (viewMode === "list") renderList(filtered);
    else renderMap(filtered, location);
  }

  applyFilters();
}

function renderList(jobs) {
  const body = document.getElementById("boardBody");
  if (jobs.length === 0) {
    body.innerHTML = emptyState("📭", "No open jobs nearby", "Try a bigger radius or check back later.");
    return;
  }
  body.innerHTML = jobs
    .map(
      (j) => `
      <a href="#/job/${j.id}" class="card card-link">
        <div class="row" style="align-items:flex-start;">
          <div class="col">
            <div class="row" style="align-items:center;gap:8px;">
              <strong>${escapeHtml(j.title)}</strong>
              <span class="badge badge-open">${escapeHtml(j.custom_category || j.category)}</span>
            </div>
            <p class="small muted" style="margin:6px 0;">${escapeHtml((j.description || "").slice(0, 140))}</p>
            <div class="tiny muted">
              ${j.customer?.full_name ? `Posted by ${escapeHtml(j.customer.full_name)} · ` : ""}${timeAgo(j.created_at)}
              ${j.distanceKm != null ? ` · ${formatDistance(j.distanceKm)}` : ""}
            </div>
          </div>
          <div class="tiny" style="text-align:right;white-space:nowrap;">
            ${j.offer_amount ? `<strong>${formatCurrency(j.offer_amount)}</strong> ${j.offer_negotiable ? "(negotiable)" : ""}` : "Offer TBD"}
          </div>
        </div>
      </a>`
    )
    .join("");
}

function renderMap(jobs, location) {
  const body = document.getElementById("boardBody");
  body.innerHTML = `<div id="boardMap" class="leaflet-map"></div>`;
  const center = location || (jobs[0] && { lat: jobs[0].lat, lng: jobs[0].lng });
  const map = createMap("boardMap", { center, zoom: 12 });
  if (!map) return;
  if (location) {
    L.marker([location.lat, location.lng], { icon: meIcon() }).addTo(map).bindPopup("You are here");
  }
  jobs.forEach((j) => {
    const label = j.offer_amount ? formatCurrency(j.offer_amount) : "";
    const marker = L.marker([j.lat, j.lng], { icon: pinIcon({ emoji: "🧰", bg: "#ff6a1a", label }) }).addTo(map);
    marker.bindPopup(`
      <b>${escapeHtml(j.title)}</b>
      <div class="tiny muted">${escapeHtml(j.custom_category || j.category)}${j.distanceKm != null ? " · " + formatDistance(j.distanceKm) : ""}</div>
      <a href="#/job/${j.id}" style="color:#1d5fd6;font-weight:700;">View job →</a>
    `);
  });
}
