import { state } from "../state.js";
import { createJob, updateJob, uploadPublicFile } from "../db.js";
import { toast, escapeHtml, photoGridHtml } from "../ui.js";
import { navigate } from "../router.js";
import { createMap, pinIcon } from "../leafletHelpers.js";
import { getCurrentPosition } from "../geo.js";
import { ensureLocation } from "../session.js";
import { SERVICE_CATEGORIES, RATE_UNITS, DEFAULT_CENTER, STORAGE_BUCKETS, MAX_PHOTO_MB } from "../config.js";

let picked = null;
let marker = null;
let map = null;
let pendingPhotos = []; // [{file, previewUrl}]

export async function renderPostJob() {
  if (!state.user) return navigate("/login");

  picked = state.myLocation || null;
  pendingPhotos = [];

  document.getElementById("app").innerHTML = `
    <div class="container-narrow">
      <div class="card" style="margin-top:20px;">
        <h2>Post a job</h2>
        <p class="muted small">Describe what you need and what you're offering. Nearby pros will see it.</p>
        <form id="jobForm" class="stack">
          <div class="field">
            <label>Title</label>
            <input type="text" id="title" required placeholder="e.g. Fix leaking kitchen tap" />
          </div>
          <div class="field">
            <label>Category</label>
            <select id="category">
              ${SERVICE_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Category not listed? (optional)</label>
            <input type="text" id="customCategory" placeholder="e.g. Aquarium cleaning" />
          </div>
          <div class="field">
            <label>Details</label>
            <textarea id="description" placeholder="Describe the job, timing, access notes, etc."></textarea>
          </div>
          <div class="field">
            <label>Photos (optional)</label>
            <div class="hint">Show pros what needs servicing — a leaking pipe, a haircut you like, etc.</div>
            <label class="file-input-label" style="margin-top:6px;">
              📸 Add photos
              <input type="file" id="jobPhotoInput" accept="image/*" multiple />
            </label>
            <div id="jobPhotoGrid"></div>
          </div>
          <div class="row">
            <div class="field col">
              <label>Your offer (₦)</label>
              <input type="number" id="offerAmount" min="0" step="0.01" placeholder="e.g. 15000" />
            </div>
            <div class="field col">
              <label>Unit</label>
              <select id="offerUnit">
                ${RATE_UNITS.map((u) => `<option value="${u.value}">${u.label}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label class="check-row"><input type="checkbox" id="offerNegotiable" checked/> Open to negotiation</label>
          </div>
          <div class="field">
            <label>Where</label>
            <div class="hint">Tap the map to set the job location.</div>
            <div id="jobMap" class="leaflet-map map-pick" style="margin-top:8px;"></div>
            <button class="btn btn-sm" id="useMyLocation" type="button" style="margin-top:8px;">📍 Use my current location</button>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Post job</button>
        </form>
      </div>
    </div>
  `;

  const startCenter = picked || (await ensureLocation()) || DEFAULT_CENTER;
  if (!picked && state.myLocation) picked = state.myLocation;

  map = createMap("jobMap", {
    center: startCenter,
    zoom: picked ? 14 : 11,
    onClick: (latlng) => setPicked(latlng.lat, latlng.lng),
  });
  if (picked) setPicked(picked.lat, picked.lng, false);

  document.getElementById("useMyLocation").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const pos = await getCurrentPosition();
      setPicked(pos.lat, pos.lng);
      map.setView([pos.lat, pos.lng], 14);
    } catch (err) {
      toast("Couldn't get your location — tap the map instead.", "error");
    }
  });

  document.getElementById("jobPhotoInput").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of files) {
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        toast(`"${file.name}" is over ${MAX_PHOTO_MB}MB — skipped`, "error");
        continue;
      }
      pendingPhotos.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    renderPhotoGrid();
  });

  document.getElementById("jobForm").addEventListener("submit", onSubmit);
}

function renderPhotoGrid() {
  const grid = document.getElementById("jobPhotoGrid");
  if (!grid) return;
  grid.innerHTML = photoGridHtml(
    pendingPhotos.map((p, i) => ({ url: p.previewUrl, key: i })),
    { removable: true }
  );
  grid.querySelectorAll(".photo-thumb-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingPhotos.splice(Number(btn.dataset.key), 1);
      renderPhotoGrid();
    });
  });
}

function setPicked(lat, lng, moveMap = true) {
  picked = { lat, lng };
  if (marker) marker.remove();
  marker = L.marker([lat, lng], { icon: pinIcon({ emoji: "📌", bg: "#ff6a1a" }) }).addTo(map);
  if (moveMap) map.panTo([lat, lng]);
}

async function onSubmit(e) {
  e.preventDefault();
  if (!picked) {
    toast("Please set the job location on the map.", "error");
    return;
  }
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const job = await createJob({
      customer_id: state.user.id,
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      category: document.getElementById("category").value,
      custom_category: document.getElementById("customCategory").value.trim() || null,
      offer_amount: document.getElementById("offerAmount").value
        ? Number(document.getElementById("offerAmount").value)
        : null,
      offer_unit: document.getElementById("offerUnit").value,
      offer_negotiable: document.getElementById("offerNegotiable").checked,
      lat: picked.lat,
      lng: picked.lng,
      status: "open",
    });

    if (pendingPhotos.length) {
      const urls = [];
      for (const p of pendingPhotos) {
        try {
          const { url } = await uploadPublicFile(STORAGE_BUCKETS.jobPhotos, job.id, p.file);
          urls.push(url);
        } catch (err) {
          toast(`Could not upload one photo: ${err.message || "error"}`, "error");
        }
      }
      if (urls.length) await updateJob(job.id, { photo_urls: urls });
    }

    toast("Job posted!", "success");
    navigate(`/job/${job.id}`);
  } catch (err) {
    toast(err.message || "Could not post job", "error");
  } finally {
    btn.disabled = false;
  }
}
