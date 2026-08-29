// Minimal hash router: register("/path/:id", handler) then start().
const routes = [];
let notFoundHandler = () => {
  document.getElementById("app").innerHTML = `<div class="container"><h2>Page not found</h2></div>`;
};

export function register(pattern, handler) {
  const paramNames = [];
  const regexStr = pattern
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        paramNames.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  routes.push({ regex: new RegExp(`^${regexStr}$`), paramNames, handler });
}

export function setNotFound(handler) {
  notFoundHandler = handler;
}

export function navigate(path) {
  if (location.hash.slice(1) === path) {
    handleRoute();
  } else {
    location.hash = path;
  }
}

function currentPath() {
  const raw = location.hash.slice(1) || "/";
  return raw.split("?")[0];
}

export function currentQuery() {
  const raw = location.hash.slice(1) || "/";
  const qIndex = raw.indexOf("?");
  return new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : "");
}

async function handleRoute() {
  const path = currentPath();
  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      window.scrollTo(0, 0);
      await route.handler(params);
      return;
    }
  }
  notFoundHandler();
}

export function start() {
  window.addEventListener("hashchange", handleRoute);
  if (!location.hash) {
    // Setting location.hash triggers "hashchange" asynchronously, which
    // will call handleRoute() for us — calling it again here would just
    // render the same route twice.
    location.hash = "#/";
  } else {
    handleRoute();
  }
}
