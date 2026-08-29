import { state } from "./state.js";
import { signOut } from "./db.js";
import { toast } from "./ui.js";

function linksHtml(path) {
  const items = state.user
    ? [
        ["#/map", "Map"],
        ["#/jobs", "Job board"],
        ["#/post-job", "Post a job"],
        ["#/my-jobs", "My jobs"],
        ["#/favorites", "Favorites"],
        [`#/profile/${state.user.id}`, "My profile"],
        ...(state.profile?.is_admin ? [["#/admin", "Admin"]] : []),
      ]
    : [
        ["#/login", "Log in"],
        ["#/signup", "Sign up"],
      ];
  return items
    .map(([href, label]) => `<a href="${href}" class="${path === href.slice(1) ? "active" : ""}">${label}</a>`)
    .join("");
}

export function renderNav() {
  const topbar = document.getElementById("topbar");
  const topnav = document.getElementById("topnav");
  const topnavMobile = document.getElementById("topnavMobile");
  const menuToggle = document.getElementById("menuToggle");

  if (!state.user) {
    topbar.hidden = true;
    return;
  }
  topbar.hidden = false;
  const path = location.hash.slice(1) || "/";

  topnav.innerHTML = linksHtml(path);
  topnavMobile.innerHTML =
    linksHtml(path) + `<a href="#" id="mobileLogout">Log out</a>`;

  if (state.user) {
    const logoutBtn = h_logout();
    topnav.appendChild(logoutBtn);
  }

  menuToggle.onclick = () => {
    topnavMobile.hidden = !topnavMobile.hidden;
    topnavMobile.classList.toggle("open", !topnavMobile.hidden);
  };

  const mobileLogout = document.getElementById("mobileLogout");
  if (mobileLogout) {
    mobileLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      await doLogout();
    });
  }

  window.addEventListener(
    "hashchange",
    () => {
      topnavMobile.hidden = true;
      topnavMobile.classList.remove("open");
    },
    { once: true }
  );
}

function h_logout() {
  const btn = document.createElement("button");
  btn.textContent = "Log out";
  btn.className = "btn-ghost";
  btn.style.cssText = "background:none;border:none;cursor:pointer;";
  btn.addEventListener("click", doLogout);
  return btn;
}

async function doLogout() {
  try {
    await signOut();
    toast("Logged out");
    location.hash = "#/";
  } catch (err) {
    toast(err.message || "Failed to log out", "error");
  }
}
