import { state, notifyStateChange } from "../state.js";
import { upsertProfile, upsertProDetails, uploadPublicFile } from "../db.js";
import { toast, escapeHtml, avatarHtml } from "../ui.js";
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

export function renderOnboarding() {
  if (!state.user) return navigate("/login");

  picked = state.myLocation || null;
  selectedServices = new Set();
  dos = [];
  donts = [];
  avatarFile = null;
  avatarPreviewUrl = null;

  document.getElementById("app").innerHTML = `
    <div class="container-narrow">
      <div class="card" style="margin-top:20px;">
        <h2>Welcome, ${escapeHtml(state.profile?.full_name || "there")} 👋</h2>
        <p class="muted small">Let's set up your account. This takes a minute.</p>

        <div class="field">
          <label>Photo (optional)</label>
          <div class="row" style="align-items:center;gap:14px;">
            <div id="avatarPreviewWrap">${avatarHtml(state.profile?.full_name, state.profile?.avatar_color, "avatar-lg")}</div>
            <label class="file-input-label">
              📷 Add photo
              <input type="file" id="avatarInput" accept="image/*" />
            </label>
          </div>
        </div>

        <div class="field">
          <label>Your name</label>
          <input type="text" id="fullName" value="${escapeHtml(state.profile?.full_name || "")}" />
        </div>

        <div class="field">
          <label>Phone (optional, shown once a job is accepted)</label>
          <input type="tel" id="phone" value="${escapeHtml(state.profile?.phone || "")}" />
        </div>

        <div class="field">
          <label>Your location</label>
          <div class="hint">Tap the map to set your location, or use the button below.</div>
          <div id="onboardMap" class="leaflet-map map-pick" style="margin-top:8px;"></div>
          <button class="btn btn-sm" id="useMyLocation" type="button" style="margin-top:8px;">📍 Use my current location</button>
        </div>

        <hr style="border:none;border-top:1px solid var(--line);margin:18px 0;" />

        <div class="field">
          <label class="check-row">
            <input type="checkbox" id="isPro" ${state.profile?.is_pro ? "checked" : ""}/>
            I also want to offer services (handyman, maid, chef, barber, tutor, etc.)
          </label>
        </div>

        <div id="proSection" class="hidden stack">
          <div class="field">
            <label>Headline</label>
            <input type="text" id="headline" placeholder="e.g. Licensed electrician, 10+ years" />
          </div>
          <div class="field">
            <label>What services do you offer?</label>
            <div class="chip-select" id="serviceChips">
              ${SERVICE_CATEGORIES.map(
                (c) => `<div class="chip" data-service="${escapeHtml(c)}">${escapeHtml(c)}</div>`
              ).join("")}
            </div>
            <div class="hint">Don't see it listed? Pick "Other" and describe it below.</div>
          </div>
          <div class="field">
            <label>Something else not listed? (optional)</label>
            <input type="text" id="customServiceNote" placeholder="e.g. Aquarium cleaning, generator repair..." />
          </div>
          <div class="row">
            <div class="field col">
              <label>Rate (₦)</label>
              <input type="number" id="rateAmount" min="0" step="0.01" placeholder="e.g. 10000" />
            </div>
            <div class="field col">
              <label>Unit</label>
              <select id="rateUnit">
                ${RATE_UNITS.map((u) => `<option value="${u.value}">${u.label}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label class="check-row"><input type="checkbox" id="rateNegotiable" checked/> Rate is negotiable</label>
          </div>
          <div class="field">
            <label>Bio</label>
            <textarea id="bio" placeholder="Tell customers about your experience..."></textarea>
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
          <p class="tiny muted">You can add work photos anytime from "Edit profile" once you're set up.</p>
        </div>

        <button class="btn btn-primary btn-block" id="saveOnboarding" style="margin-top:18px;">Save &amp; continue</button>
      </div>
    </div>
  `;

  const center = picked || state.myLocation || DEFAULT_CENTER;
  map = createMap("onboardMap", {
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

  document.getElementById("saveOnboarding").addEventListener("click", saveOnboarding);
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

async function saveOnboarding() {
  const btn = document.getElementById("saveOnboarding");
  const isPro = document.getElementById("isPro").checked;
  if (!picked) {
    toast("Please set your location on the map first.", "error");
    return;
  }
  btn.disabled = true;
  try {
    const fullName = document.getElementById("fullName").value.trim();
    const phone = document.getElementById("phone").value.trim();

    let avatar_url = state.profile?.avatar_url || null;
    if (avatarFile) {
      const { url } = await uploadPublicFile(STORAGE_BUCKETS.avatars, state.user.id, avatarFile);
      avatar_url = url;
    }

    state.profile = await upsertProfile(state.user.id, {
      full_name: fullName,
      phone,
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
        dos,
        donts,
        is_available: true,
      });
    }
    notifyStateChange();
    toast("You're all set!", "success");
    navigate("/map");
  } catch (err) {
    toast(err.message || "Could not save your profile", "error");
  } finally {
    btn.disabled = false;
  }
}
