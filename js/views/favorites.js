import { state } from "../state.js";
import { listFavorites, removeFavorite, getRatingStatsBulk } from "../db.js";
import { escapeHtml, starsHtml, avatarHtml, toast, emptyState, loadingScreen } from "../ui.js";
import { navigate } from "../router.js";
import { formatCurrency } from "../config.js";

export async function renderFavorites() {
  if (!state.user) return navigate("/login");

  document.getElementById("app").innerHTML = `
    <div class="container">
      <h2>Favorites</h2>
      <p class="muted small" style="margin-top:-6px;">Pros you've saved for later.</p>
      <div id="favBody">${loadingScreen("Loading your favorites…")}</div>
    </div>
  `;

  let favs = [];
  try {
    favs = await listFavorites(state.user.id);
  } catch (err) {
    toast(err.message || "Could not load favorites", "error");
  }

  const body = document.getElementById("favBody");
  if (favs.length === 0) {
    body.innerHTML = emptyState(
      "🤍",
      "No favorites yet",
      "Tap the heart on a pro's profile to save them here."
    );
    return;
  }

  let statsById = {};
  try {
    const stats = await getRatingStatsBulk(favs.map((f) => f.pro_id));
    statsById = Object.fromEntries(stats.map((s) => [s.profile_id, s]));
  } catch (err) {
    // Non-fatal — cards still render without ratings.
  }

  body.innerHTML = favs
    .map((f) => {
      const p = f.pro;
      if (!p) return "";
      const pd = p.pro_details;
      const rs = statsById[p.id];
      return `
      <div class="card">
        <div class="row" style="align-items:center;gap:12px;">
          <a href="#/profile/${p.id}" class="row" style="align-items:center;gap:12px;flex:1;min-width:0;">
            ${avatarHtml(p.full_name, p.avatar_color, "avatar-sm", p.avatar_url)}
            <div class="col">
              <strong>${escapeHtml(p.full_name || "Unnamed")}</strong>
              <div style="margin-top:2px;">${starsHtml(rs?.avg_stars ?? null, rs?.rating_count ?? 0)}</div>
              ${pd?.headline ? `<div class="tiny muted" style="margin-top:2px;">${escapeHtml(pd.headline)}</div>` : ""}
            </div>
          </a>
          <div class="col" style="flex:0 0 auto;text-align:right;">
            ${pd?.rate_amount ? `<div class="tiny"><strong>${formatCurrency(pd.rate_amount)}</strong></div>` : ""}
            <button class="btn btn-sm btn-danger" data-remove="${p.id}" style="margin-top:6px;">Remove</button>
          </div>
        </div>
      </div>`;
    })
    .join("");

  body.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const proId = btn.dataset.remove;
      btn.disabled = true;
      try {
        await removeFavorite(state.user.id, proId);
        toast("Removed from favorites");
        renderFavorites();
      } catch (err) {
        toast(err.message || "Could not remove favorite", "error");
        btn.disabled = false;
      }
    });
  });
}
