// Shared Leaflet helpers. We deliberately avoid the default Leaflet marker
// images (they need extra asset-path config) and use styled divIcons instead.
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./config.js";

const activeMaps = new Map();

export function createMap(containerId, { center, zoom, onClick } = {}) {
  destroyMap(containerId);
  const el = document.getElementById(containerId);
  if (!el) return null;
  const map = L.map(containerId, { zoomControl: true }).setView(
    [center?.lat ?? DEFAULT_CENTER.lat, center?.lng ?? DEFAULT_CENTER.lng],
    zoom ?? DEFAULT_ZOOM
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  if (onClick) map.on("click", (e) => onClick(e.latlng));
  activeMaps.set(containerId, map);
  // Leaflet sometimes mis-measures its container if it was hidden/created
  // mid-layout; a delayed invalidateSize fixes grey-tile issues reliably.
  setTimeout(() => map.invalidateSize(), 80);
  return map;
}

export function destroyMap(containerId) {
  const existing = activeMaps.get(containerId);
  if (existing) {
    existing.remove();
    activeMaps.delete(containerId);
  }
}

export function pinIcon({ emoji = "📍", bg = "#111318", label = "" } = {}) {
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px);">
        ${label ? `<div class="pin-badge">${label}</div>` : ""}
        <div style="
          width:34px;height:34px;border-radius:50% 50% 50% 0;
          background:${bg};transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 6px rgba(0,0,0,.35);margin-top:4px;">
          <span style="transform:rotate(45deg);font-size:16px;">${emoji}</span>
        </div>
      </div>`,
    iconSize: [34, 46],
    iconAnchor: [17, 46],
    popupAnchor: [0, -46],
  });
}

export function meIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:16px;height:16px;border-radius:50%;background:#1d5fd6;
      border:3px solid #fff;box-shadow:0 0 0 2px #1d5fd6, 0 2px 6px rgba(0,0,0,.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
