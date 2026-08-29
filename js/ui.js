// Tiny DOM / UI utility layer — no framework, just helpers used everywhere.

export function h(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toast(message, type = "info", ms = 3200) {
  const root = document.getElementById("toast-root");
  const el = h(`<div class="toast ${type}">${escapeHtml(message)}</div>`);
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .2s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, ms);
}

export function openModal(innerHtml, { onMount } = {}) {
  closeModal();
  const root = document.getElementById("modal-root");
  const backdrop = h(`
    <div class="modal-backdrop" id="activeModal">
      <div class="modal-box">${innerHtml}</div>
    </div>
  `);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  root.appendChild(backdrop);
  if (onMount) onMount(backdrop);
  return backdrop;
}

export function closeModal() {
  const existing = document.getElementById("activeModal");
  if (existing) existing.remove();
}

export function starsHtml(avg, count) {
  const rounded = avg ? Math.round(avg) : 0;
  let s = "";
  for (let i = 1; i <= 5; i++) s += i <= rounded ? "★" : '<span class="empty">★</span>';
  const label = avg ? `${avg.toFixed(1)}` : "New";
  const countLabel = count ? ` (${count})` : "";
  return `<span class="stars">${s} <span class="tiny muted">${label}${countLabel}</span></span>`;
}

export function avatarHtml(name, color, sizeClass = "", avatarUrl = "") {
  if (avatarUrl) {
    return `<div class="avatar ${sizeClass} avatar-photo"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name || "")}" /></div>`;
  }
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ? w[0].toUpperCase() : ""))
    .join("") || "?";
  return `<div class="avatar ${sizeClass}" style="background:${escapeHtml(color || "#2563eb")}">${escapeHtml(initials)}</div>`;
}

// A small grid of photo thumbnails with an optional per-photo remove button.
// `photos` is an array of { url, key } where key identifies the photo to the
// caller's onRemove callback (an id for DB rows, a storage path for raw files).
export function photoGridHtml(photos, { removable = false } = {}) {
  if (!photos || !photos.length) return "";
  return `<div class="photo-grid">
    ${photos
      .map(
        (p, i) => `
      <div class="photo-thumb" data-key="${escapeHtml(String(p.key ?? i))}">
        <img src="${escapeHtml(p.url)}" alt="" />
        ${removable ? `<button type="button" class="photo-thumb-remove" data-key="${escapeHtml(String(p.key ?? i))}">×</button>` : ""}
      </div>`
      )
      .join("")}
  </div>`;
}

export function badgeHtml(status, labels) {
  const label = (labels && labels[status]) || status;
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

export function loadingScreen(message = "Loading…") {
  return `<div class="loading-screen"><div class="spinner"></div><div>${escapeHtml(message)}</div></div>`;
}

export function emptyState(icon, title, subtitle = "") {
  return `
    <div class="empty-state">
      <div class="big">${icon}</div>
      <div><strong>${escapeHtml(title)}</strong></div>
      ${subtitle ? `<div class="small">${escapeHtml(subtitle)}</div>` : ""}
    </div>
  `;
}

export function confirmDialog(message, { okLabel = "Confirm", danger = false } = {}) {
  return new Promise((resolve) => {
    const modal = openModal(`
      <div class="modal-head"><h3>Are you sure?</h3></div>
      <p>${escapeHtml(message)}</p>
      <div class="row" style="justify-content:flex-end;margin-top:16px;">
        <button class="btn" id="confirmNo">Cancel</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="confirmYes">${escapeHtml(okLabel)}</button>
      </div>
    `);
    modal.querySelector("#confirmNo").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    modal.querySelector("#confirmYes").addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
  });
}

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
