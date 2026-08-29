import { state, notifyStateChange } from "../state.js";
import {
  upsertProfile,
  upsertProDetails,
  getProDetails,
  uploadPublicFile,
  listProPhotos,
  addProPhoto,
  deleteProPhoto,
} from "../db.js";
import { toast, escapeHtml, avatarHtml, photoGridHtml } from "../ui.js";
import { navigate } from "../router.js";
import { createMap, pinIcon } from "../leafletHelpers.js";
import { getCurrentPosition } from "../geo.js";
import { SERVICE_CATEGORIES, RATE_UNITS, DEFAULT_CENTER, STORAGE_BUCKETS, MAX_PHOTO_MB } from "../config.js";

let picked = null;
let marker = null;
let map = null;
let selectedServices = new Set();
let dos = [];
let donts = [];
let avatarFile = null;
let avatarPreviewUrl = null;
let portfolioPhotos = [];

export async function renderProfileEdit() {
  if (!state.user) return navigate("/login");

  const proDetails = state.profile?.is_pro ? state.proDetails || (await getProDetails(state.user.id)) : null;
  state.proDetails = proDetails;
  portfolioPhotos = state.profile?.is_pro ? await listProPhotos(state.user.id).catch(() => []) : [];

  picked = state.myLocation || (state.profile?.lat != null ? { lat: state.profile.lat, lng: state.profile.lng } : null);
  selectedServices = new Set(proDetails?.services || []);
  dos = [...(proDetails?.dos || [])];
  donts = [...(proDetails?.donts || [])];
  avatarFile = null;
  avatarPreviewUrl = null;

  document.getElementById("app").innerHTML = `
    <div class="container-narrow">
      <div class="card" style="margin-top:20px;">
        <h2>Edit profile</h2>

        <div class="field">
          <label>Photo</label>
          <div class="row" style="align-items:center;gap:14px;">
            <div id="avatarPreviewWrap">${avatarHtml(state.profile?.full_name, state.profile?.avatar_color, "avatar-lg", state.profile?.avatar_url)}</div>
            <label class="file-input-label">
              📷 Change photo
              <input type="file" id="avatarInput" accept="image/*" />
            </label>
          </div>
        </div>

        <div class="field">
          <label>Your name</label>
          <input type="text" id="fullName" value="${escapeHtml(state.profile?.full_name || "")}" />
        </div>
        <div class="field">
          <label>Phone</label>
          <input type="tel" id="phone" value="${escapeHtml(state.profile?.phone || "")}" />
        </div>

        <div class="field">
          <label>Your location</label>
          <div id="editMap" class="leaflet-map map-pick" style="margin-top:8px;"></div>
          <button class="btn btn-sm" id="useMyLocation" type="button" style="margin-top:8px;">📍 Use my current location</button>
        </div>

        <hr style="border:none;border-top:1px solid var(--line);margin:18px 0;" />

        <div class="field">
          <label class="check-row">
            <input type="checkbox" id="isPro" ${state.profile?.is_pro ? "checked" : ""}/>
            I offer services as a pro (handyman, maid, chef, barber, tutor, etc.)
          </label>
        </div>

        <div id="proSection" class="hidden stack">
          <div class="field">
            <label class="check-row"><input type="checkbox" id="isAvailable" ${proDetails?.is_available !== false ? "checked" : ""}/> Currently available for new jobs</label>
          </div>
          <div class="field">
            <label>Headline</label>
            <input type="text" id="headline" value="${escapeHtml(proDetails?.headline || "")}" placeholder="e.g. Licensed electrician, 10+ years" />
          </div>
          <div class="field">
            <label>What services do you offer?</label>
            <div class="chip-select" id="serviceChips">
              ${SERVICE_CATEGORIES.map(
                (c) =>
                  `<div class="chip ${selectedServices.has(c) ? "selected" : ""}" data-service="${escapeHtml(c)}">${escapeHtml(c)}</div>`
              ).join("")}
            </div>
            <div class="hint">Don't see it listed? Pick "Other" and describe it below.</div>
          </div>
          <div class="field">
            <label>Something else not listed? (optional)</label>
            <input type="text" id="customServiceNote" value="${escapeHtml(proDetails?.custom_service_note || "")}" placeholder="e.g. Aquarium cleaning, generator repair..." />
          </div>
          <div class="row">
            <div class="field col">
              <label>Rate (₦)</label>
              <input type="number" id="rateAmount" min="0" step="0.01" value="${proDetails?.rate_amount ?? ""}" placeholder="e.g. 10000" />
            </div>
            <div class="field col">
              <label>Unit</label>
              <select id="rateUnit">
                ${RATE_UNITS.map(
                  (u) => `<option value="${u.value}" ${proDetails?.rate_unit === u.value ? "selected" : ""}>${u.label}</option>`
                ).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label class="check-row"><input type="checkbox" id="rateNegotiable" ${proDetails?.rate_negotiable !== false ? "checked" : ""}/> Rate is negotiable</label>
          </div>
          <div class="field">
            <label>Years of experience</label>
            <input type="number" id="yearsExperience" min="0" value="${proDetails?.years_experience ?? ""}" />
          </div>
          <div class="field">
            <label>Bio</label>
            <textarea id="bio">${escapeHtml(proDetails?.bio || "")}</textarea>
          </div>
          <div class="field">
            <label>DOs — what you will do</label>
            <div class="tag-input-row">
              <input type="text" id="doInput" placeholder="e.g. Same-day emergency callouts" />
              <button class="btn btn-sm" id="addDo" type="button">Add</button>
            </div>
            <div class="tag-list" id="doList"></div>
          </div>
          <div class="field">
            <label>DON'Ts — what you won't do</label>
            <div class="tag-input-row">
              <input type="text" id="dontInput" placeholder="e.g. No work after 8pm" />
              <button class="btn btn-sm" id="addDont" type="button">Add</button>
            </div>
            <div class="tag-list" id="dontList"></div>
          </div>
          <div class="field">
            <label>Work photos</label>
            <div class="hint">Show off finished jobs — customers trust pros with real photos.</div>
            <label class="file-input-label" style="margin-top:6px;">
              📸 Add photos
              <input type="file" id="portfolioInput" accept="image/*" multiple />
            </label>
            <div id="portfolioGrid">${photoGridHtml(portfolioPhotos.map((p) => ({ url: p.url, key: p.id })), { removable: true })}</div>
          </div>
        </div>

        <button class="btn btn-primary btn-block" id="saveProfile" style="margin-top:18px;">Save changes</button>
      </div>
    </div>
  `;

  const center = picked || DEFAULT_CENTER;
  map = createMap("editMap", {
    center,
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

  document.getElementById("avatarInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast(`Photo must be under ${MAX_PHOTO_MB}MB`, "error");
      e.target.value = "";
      return;
    }
    avatarFile = file;
    avatarPreviewUrl = URL.createObjectURL(file);
    document.getElementById("avatarPreviewWrap").innerHTML = `<div class="avatar avatar-lg avatar-photo"><img src="${avatarPreviewUrl}" alt="" /></div>`;
  });

  document.getElementById("portfolioInput").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    for (const file of files) {
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        toast(`"${file.name}" is over ${MAX_PHOTO_MB}MB — skipped`, "error");
        continue;
      }
      try {
        const { url } = await uploadPublicFile(STORAGE_BUCKETS.portfolio, state.user.id, file);
        const row = await addProPhoto(state.user.id, url);
        portfolioPhotos = [row, ...portfolioPhotos];
      } catch (err) {
        toast(err.message || `Could not upload "${file.name}"`, "error");
      }
    }
    renderPortfolioGrid();
  });

  const isProCheckbox = document.getElementById("isPro");
  const proSection = document.getElementById("proSection");
  const syncProVisibility = () => proSection.classList.toggle("hidden", !isProCheckbox.checked);
  syncProVisibility();
  isProCheckbox.addEventListener("change", syncProVisibility);

  document.getElementById("serviceChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const val = chip.dataset.service;
    if (selectedServices.has(val)) {
      selectedServices.delete(val);
      chip.classList.remove("selected");
    } else {
      selectedServices.add(val);
      chip.classList.add("selected");
    }
  });

  wireTagInput("doInput", "addDo", "doList", dos, "do");
  wireTagInput("dontInput", "addDont", "dontList", donts, "dont");
  renderPortfolioGrid();

  document.getElementById("saveProfile").addEventListener("click", save);
}

function renderPortfolioGrid() {
  const grid = document.getElementById("portfolioGrid");
  if (!grid) return;
  grid.innerHTML = photoGridHtml(portfolioPhotos.map((p) => ({ url: p.url, key: p.id })), { removable: true });
  grid.querySelectorAll(".photo-thumb-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.key;
      btn.disabled = true;
      try {
        await deleteProPhoto(id);
        portfolioPhotos = portfolioPhotos.filter((p) => p.id !== id);
        renderPortfolioGrid();
      } catch (err) {
        toast(err.message || "Could not remove photo", "error");
        btn.disabled = false;
      }
    });
  });
}

function setPicked(lat, lng, moveMap = true) {
  picked = { lat, lng };
  if (marker) marker.remove();
  marker = L.marker([lat, lng], { icon: pinIcon({ emoji: "🏠", bg: "#1d5fd6" }) }).addTo(map);
  if (moveMap) map.panTo([lat, lng]);
}

function wireTagInput(inputId, btnId, listId, arr, kind) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  const list = document.getElementById(listId);

  function render() {
    list.innerHTML = arr
      .map(
        (t, i) =>
          `<span class="tag ${kind}">${escapeHtml(t)} <button type="button" data-i="${i}">×</button></span>`
      )
      .join("");
    list.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        arr.splice(Number(b.dataset.i), 1);
        render();
      })
    );
  }
  function add() {
    const v = input.value.trim();
    if (!v) return;
    arr.push(v);
    input.value = "";
    render();
  }
  btn.addEventListener("click", add);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  });
  render();
}

async function save() {
  const btn = document.getElementById("saveProfile");
  const isPro = document.getElementById("isPro").checked;
  if (!picked) {
    toast("Please set your location on the map.", "error");
    return;
  }
  btn.disabled = true;
  try {
    let avatar_url = state.profile?.avatar_url || null;
    if (avatarFile) {
      const { url } = await uploadPublicFile(STORAGE_BUCKETS.avatars, state.user.id, avatarFile);
      avatar_url = url;
    }

    state.profile = await upsertProfile(state.user.id, {
      full_name: document.getElementById("fullName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      is_pro: isPro,
      lat: picked.lat,
      lng: picked.lng,
      location_updated_at: new Date().toISOString(),
      avatar_url,
    });
    state.myLocation = picked;

    if (isPro) {
      state.proDetails = await upsertProDetails(state.user.id, {
        headline: document.getElementById("headline").value.trim(),
        bio: document.getElementById("bio").value.trim(),
        services: Array.from(selectedServices),
        custom_service_note: document.getElementById("customServiceNote").value.trim() || null,
        rate_amount: document.getElementById("rateAmount").value
          ? Number(document.getElementById("rateAmount").value)
          : null,
        rate_unit: document.getElementById("rateUnit").value,
        rate_negotiable: document.getElementById("rateNegotiable").checked,
        years_experience: document.getElementById("yearsExperience").value
          ? Number(document.getElementById("yearsExperience").value)
          : null,
        is_available: document.getElementById("isAvailable").checked,
        dos,
        donts,
      });
    }
    notifyStateChange();
    toast("Profile updated!", "success");
    navigate(`/profile/${state.user.id}`);
  } catch (err) {
    toast(err.message || "Could not save profile", "error");
  } finally {
    btn.disabled = false;
  }
}
