import { state } from "../state.js";
import {
  getProfile,
  getProDetails,
  getRatingStats,
  getRatingsFor,
  listProPhotos,
  listFavorites,
  addFavorite,
  removeFavorite,
} from "../db.js";
import { escapeHtml, starsHtml, avatarHtml, photoGridHtml, timeAgo, toast, loadingScreen } from "../ui.js";
import { navigate } from "../router.js";
import { formatCurrency } from "../config.js";

export async function renderProfileView({ id }) {
  if (!state.user) return navigate("/login");
  document.getElementById("app").innerHTML = `<div class="container-narrow">${loadingScreen("Loading profile…")}</div>`;

  let profile, proDetails, stats, ratings, portfolio;
  try {
    [profile, proDetails, stats, ratings] = await Promise.all([
      getProfile(id),
      getProDetails(id),
      getRatingStats(id),
      getRatingsFor(id),
    ]);
    portfolio = profile?.is_pro ? await listProPhotos(id).catch(() => []) : [];
  } catch (err) {
    toast(err.message || "Could not load profile", "error");
    return;
  }

  if (!profile) {
    document.getElementById("app").innerHTML = `<div class="container-narrow"><div class="empty-state"><div class="big">🙈</div><strong>Profile not found</strong></div></div>`;
    return;
  }

  const isMe = id === state.user.id;
  let isFavorited = false;
  if (!isMe && profile.is_pro) {
    try {
      const favs = await listFavorites(state.user.id);
      isFavorited = favs.some((f) => f.pro_id === id);
    } catch (err) {
      // Non-fatal — favorite button still renders, just defaults to unsaved.
    }
  }

  document.getElementById("app").innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <div class="detail-header">
          ${avatarHtml(profile.full_name, profile.avatar_color, "avatar-lg", profile.avatar_url)}
          <div class="col">
            <h2 style="margin:0;">${escapeHtml(profile.full_name || "Unnamed")}</h2>
            <div style="margin-top:4px;">${starsHtml(stats?.avg_stars ?? null, stats?.rating_count ?? 0)}</div>
            ${profile.is_pro ? `<span class="badge badge-open" style="margin-top:6px;">Service pro</span>` : ""}
          </div>
          ${isMe ? `<a href="#/profile/me/edit" class="btn btn-sm">Edit</a>` : ""}
          ${
            !isMe && profile.is_pro
              ? `<button class="btn btn-sm fav-btn ${isFavorited ? "active" : ""}" id="favBtn">${isFavorited ? "★ Saved" : "☆ Save"}</button>`
              : ""
          }
        </div>

        ${
          profile.is_pro && proDetails
            ? `
          ${proDetails.headline ? `<p><strong>${escapeHtml(proDetails.headline)}</strong></p>` : ""}
          ${proDetails.bio ? `<p class="small">${escapeHtml(proDetails.bio)}</p>` : ""}
          <div class="kv-list">
            ${
              proDetails.services?.length
                ? `<div class="kv-row"><span class="muted">Services</span><span>${proDetails.services.map(escapeHtml).join(", ")}</span></div>`
                : ""
            }
            ${
              proDetails.custom_service_note
                ? `<div class="kv-row"><span class="muted">Also does</span><span>${escapeHtml(proDetails.custom_service_note)}</span></div>`
                : ""
            }
            ${
              proDetails.rate_amount
                ? `<div class="kv-row"><span class="muted">Rate</span><span>${formatCurrency(proDetails.rate_amount)} / ${escapeHtml(
                    proDetails.rate_unit
                  )} ${proDetails.rate_negotiable ? "(negotiable)" : "(fixed)"}</span></div>`
                : ""
            }
            ${
              proDetails.years_experience
                ? `<div class="kv-row"><span class="muted">Experience</span><span>${proDetails.years_experience} years</span></div>`
                : ""
            }
            <div class="kv-row"><span class="muted">Availability</span><span>${proDetails.is_available ? "Available now" : "Not available"}</span></div>
          </div>
          ${
            proDetails.dos?.length || proDetails.donts?.length
              ? `<div class="dos-donts" style="margin-top:14px;">
                  <div class="dd-col do">
                    <h4>DOs</h4>
                    <ul>${(proDetails.dos || []).map((d) => `<li>${escapeHtml(d)}</li>`).join("") || "<li class='muted'>—</li>"}</ul>
                  </div>
                  <div class="dd-col dont">
                    <h4>DON'Ts</h4>
                    <ul>${(proDetails.donts || []).map((d) => `<li>${escapeHtml(d)}</li>`).join("") || "<li class='muted'>—</li>"}</ul>
                  </div>
                </div>`
              : ""
          }
          ${
            portfolio?.length
              ? `<div style="margin-top:16px;">
                  <h4 style="text-transform:uppercase;font-size:.82rem;letter-spacing:.04em;color:var(--ink-soft);">Work photos</h4>
                  ${photoGridHtml(portfolio.map((p) => ({ url: p.url, key: p.id })))}
                </div>`
              : ""
          }
        `
            : profile.is_pro
            ? `<p class="muted small">This pro hasn't finished setting up their details yet.</p>`
            : `<p class="muted small">Customer account.</p>`
        }
      </div>

      <div class="card">
        <h3>Reviews ${ratings?.length ? `(${ratings.length})` : ""}</h3>
        ${
          ratings && ratings.length
            ? ratings
                .map(
                  (r) => `
              <div style="padding:10px 0;border-bottom:1px solid var(--line);">
                <div class="row" style="align-items:center;gap:8px;">
                  ${avatarHtml(r.rater?.full_name, r.rater?.avatar_color, "avatar-sm")}
                  <strong class="small">${escapeHtml(r.rater?.full_name || "Someone")}</strong>
                  <span class="tiny muted">${timeAgo(r.created_at)}</span>
                </div>
                <div class="stars" style="margin:4px 0;">${"★".repeat(r.stars)}${'<span class="empty">★</span>'.repeat(5 - r.stars)}</div>
                ${r.comment ? `<p class="small" style="margin:0;">${escapeHtml(r.comment)}</p>` : ""}
              </div>`
                )
                .join("")
            : `<p class="muted small">No reviews yet.</p>`
        }
      </div>
    </div>
  `;

  const favBtn = document.getElementById("favBtn");
  if (favBtn) {
    favBtn.addEventListener("click", async () => {
      favBtn.disabled = true;
      try {
        if (isFavorited) {
          await removeFavorite(state.user.id, id);
          isFavorited = false;
          toast("Removed from favorites");
        } else {
          await addFavorite(state.user.id, id);
          isFavorited = true;
          toast("Saved to favorites", "success");
        }
        favBtn.textContent = isFavorited ? "★ Saved" : "☆ Save";
        favBtn.classList.toggle("active", isFavorited);
      } catch (err) {
        toast(err.message || "Could not update favorites", "error");
      } finally {
        favBtn.disabled = false;
      }
    });
  }
}
