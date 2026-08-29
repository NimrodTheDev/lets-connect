import { state, onStateChange } from "./state.js";
import { bootSession } from "./session.js";
import { register, start, navigate } from "./router.js";
import { renderNav } from "./nav.js";
import { renderLanding } from "./views/landing.js";
import { renderLogin, renderSignup } from "./views/authScreens.js";
import { renderOnboarding } from "./views/onboarding.js";
import { renderMapView } from "./views/mapView.js";
import { renderJobBoard } from "./views/jobBoard.js";
import { renderPostJob } from "./views/postJob.js";
import { renderMyJobs } from "./views/myJobs.js";
import { renderJobDetail } from "./views/jobDetail.js";
import { renderProfileView } from "./views/profileView.js";
import { renderProfileEdit } from "./views/profileEdit.js";
import { renderAdmin } from "./views/admin.js";
import { renderFavorites } from "./views/favorites.js";

function guardedRender(renderFn) {
  return async (params) => {
    if (!state.user) {
      navigate("/login");
      return;
    }
    // Nudge new users to finish onboarding (set a location) before using the
    // rest of the app, but never trap them on the onboarding/edit screens.
    const path = location.hash.slice(1) || "/";
    const exempt = path.startsWith("/onboarding") || path.startsWith("/profile/me/edit");
    if (!exempt && state.profile && state.profile.lat == null) {
      navigate("/onboarding");
      return;
    }
    await renderFn(params);
  };
}

register("/", () => {
  if (state.user) {
    navigate("/map");
  } else {
    renderLanding();
  }
});
register("/login", () => (state.user ? navigate("/map") : renderLogin()));
register("/signup", () => (state.user ? navigate("/map") : renderSignup()));
register("/onboarding", () => {
  if (!state.user) return navigate("/login");
  renderOnboarding();
});
register("/map", guardedRender(renderMapView));
register("/jobs", guardedRender(renderJobBoard));
register("/post-job", guardedRender(renderPostJob));
register("/my-jobs", guardedRender(renderMyJobs));
register("/favorites", guardedRender(renderFavorites));
register("/job/:id", guardedRender(renderJobDetail));
register("/profile/me/edit", () => {
  if (!state.user) return navigate("/login");
  renderProfileEdit();
});
register("/profile/:id", guardedRender(renderProfileView));
register("/admin", () => {
  if (!state.user) return navigate("/login");
  renderAdmin();
});

onStateChange(renderNav);

async function main() {
  await bootSession();
  renderNav();
  start();
}

main();
