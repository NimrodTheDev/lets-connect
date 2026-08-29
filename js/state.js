// Single shared, mutable app state. Kept intentionally simple (no store
// library) since the app is small and every view reads/writes it directly.
export const state = {
  session: null,
  user: null, // auth user
  profile: null, // row from public.profiles
  proDetails: null, // row from public.pro_details (if is_pro)
  myPhone: "", // own number from public.user_phones (never on `profile`)
  myLocation: null, // { lat, lng } best-known current location
  radiusKm: null, // set from config default at boot
};

const listeners = new Set();

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyStateChange() {
  listeners.forEach((fn) => fn(state));
}

export function isLoggedIn() {
  return !!state.user;
}
