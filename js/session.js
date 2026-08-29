import { sb, getProfile, getProDetails, getSession } from "./db.js";
import { state, notifyStateChange } from "./state.js";
import { DEFAULT_RADIUS_KM } from "./config.js";
import { getCurrentPosition } from "./geo.js";

state.radiusKm = DEFAULT_RADIUS_KM;

export async function bootSession() {
  const session = await getSession();
  state.session = session;
  state.user = session ? session.user : null;
  if (state.user) {
    await loadProfileIntoState();
  }
  notifyStateChange();

  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session ? session.user : null;
    if (state.user) {
      await loadProfileIntoState();
    } else {
      state.profile = null;
      state.proDetails = null;
    }
    notifyStateChange();
  });
}

export async function loadProfileIntoState() {
  if (!state.user) return;
  try {
    state.profile = await getProfile(state.user.id);
    if (state.profile && state.profile.is_pro) {
      state.proDetails = await getProDetails(state.user.id);
    } else {
      state.proDetails = null;
    }
    if (state.profile && state.profile.lat != null && state.profile.lng != null) {
      state.myLocation = { lat: state.profile.lat, lng: state.profile.lng };
    }
  } catch (err) {
    console.error("Failed to load profile", err);
  }
}

export async function ensureLocation() {
  if (state.myLocation) return state.myLocation;
  try {
    const pos = await getCurrentPosition();
    state.myLocation = pos;
    notifyStateChange();
    return pos;
  } catch (err) {
    return null;
  }
}
