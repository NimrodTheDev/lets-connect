import { state, notifyStateChange } from "../state.js";
import { listNearbyPros, getRatingStatsBulk } from "../db.js";
import { createMap, pinIcon, meIcon } from "../leafletHelpers.js";
import { ensureLocation } from "../session.js";
import { haversineKm, formatDistance } from "../geo.js";
import { starsHtml, escapeHtml, loadingScreen, toast } from "../ui.js";
import { navigate } from "../router.js";
import { RADIUS_OPTIONS_KM, formatCurrency } from "../config.js";

export async function renderMapView() {
  if (!state.user) return navigate("/login");

  document.getElementById("app").innerHTML = `
    <div class="container">
      <div class="row wrap" style="align-items:center;margin-bottom:12px;gap:10px;">
        <h2 style="margin:0;">Pros near you</h2>
        <span class="spacer"></span>
        <label class="small muted" style="display:flex;align-items:center;gap:6px;">
          Within
          <select id="radiusSelect">
            ${RADIUS_OPTIONS_KM.map(
              (r) => `<option value="${r}" ${r === state.radiusKm ? "selected" : ""}>${r} km</option>`
            ).join("")}
          </select>
        </label>
        <a href="#/jobs" class="btn btn-sm">📋 Job board</a>
        <a href="#/post-job" class="btn btn-sm btn-primary">+ Post a job</a>
      </div>
      <div class="map-wrap">
        <div id="map" class="leaflet-map">${loadingScreen("Finding pros nearby…")}</div>
      </div>
      <div id="proListFallback"></div>
    </div>
  `;

  const location = await ensureLocation();
  if (!location) {
    toast("Turn on location access to see pros on the map.", "error", 4500);
  }

  document.getElementById("radiusSelect").addEventListener("change", (e) => {
    state.radiusKm = Number(e.target.value);
    notifyStateChange();
    renderMapView();
  });

  let pros = [];
  try {
    pros = await listNearbyPros({ excludeId: state.user.id });
  } catch (err) {
    toast(err.message || "Could not load nearby pros", "error");
  }

  const center = location || (pros[0] && { lat: pros[0].lat, lng: pros[0].lng }) || undefined;
  const mapEl = document.getElementById("map");
  mapEl.innerHTML = "";
  const map = createMap("map", { center, zoom: 12 });
  if (!map) return;

  if (location) {
    L.marker([location.lat, location.lng], { icon: meIcon() })
      .addTo(map)
      .bindPopup("You are here");
  }

  const nearby = pros
    .map((p) => ({ ...p, distanceKm: location ? haversineKm(location.lat, location.lng, p.lat, p.lng) : null }))
    .filter((p) => (location ? p.distanceKm <= state.radiusKm : true))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  let statsById = {};
  try {
    const stats = await getRatingStatsBulk(nearby.map((p) => p.id));
    statsById = Object.fromEntries(stats.map((s) => [s.profile_id, s]));
  } catch (err) {
    // Non-fatal — pins still render without ratings.
  }

  nearby.forEach((p) => {
    const pd = p.pro_details;
    const rs = statsById[p.id];
    const priceLabel = pd?.rate_amount ? `${formatCurrency(pd.rate_amount)}${pd.rate_negotiable ? "±" : ""}` : "";
    const marker = L.marker([p.lat, p.lng], {
      icon: pinIcon({ emoji: "🛠️", bg: "#111318", label: priceLabel }),
    }).addTo(map);
    marker.bindPopup(`
      <b>${escapeHtml(p.full_name)}</b>
      ${pd?.headline ? `<div>${escapeHtml(pd.headline)}</div>` : ""}
      <div style="margin:4px 0;">${(pd?.services || []).slice(0, 3).map((s) => escapeHtml(s)).join(", ")}${pd?.custom_service_note ? ` · ${escapeHtml(pd.custom_service_note)}` : ""}</div>
      <div style="margin:4px 0;">${starsHtml(rs?.avg_stars ?? null, rs?.rating_count ?? 0)}</div>
      ${p.distanceKm != null ? `<div class="tiny muted">${formatDistance(p.distanceKm)}</div>` : ""}
      <a href="#/profile/${p.id}" style="color:#1d5fd6;font-weight:700;">View profile →</a>
    `);
  });

  if (nearby.length === 0) {
    document.getElementById("proListFallback").innerHTML = `
      <div class="empty-state">
        <div class="big">🔎</div>
        <strong>No pros found within ${state.radiusKm} km yet.</strong>
        <div class="small">Try a bigger radius, or check the job board instead.</div>
      </div>
    `;
  }
}
