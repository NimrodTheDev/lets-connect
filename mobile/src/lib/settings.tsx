import {isRunningInExpoGo} from "expo";
import * as Location from "expo-location";
import {LocationAccuracy} from "expo-location";
import {createContext, type ReactNode, useContext, useEffect, useState,} from "react";
import {AppState, Platform} from "react-native";
import {api} from "@/lib/api";

// ---------- Types ----------

export type PermissionState = {
  status: "undetermined" | "granted" | "denied";
  /** False once the user has said no and the OS won't show the prompt again. */
  canAskAgain: boolean;
};

export type Coords = {
  latitude: number;
  longitude: number;
  /** Accuracy radius in metres, if the OS reports it. */
  accuracy: number | null;
  timestamp: number;
};

/** Everything here is saved on the device. */
export type StoredSettings = {
  profile: {
    username: string;
    /** Long-term interests shown on the profile, e.g. "Photography". */
    interests: string[];
    /** Set once the first-login setup is finished; gates the rest of the app. */
    onboarded: boolean;
  };
  discovery: {
    /** How far to look for people, in km. */
    radiusKm: number;
    /** Only show people with at least one of these tags. Empty = everyone. */
    tags: string[];
  };
  visibility: {
    /** When the user's "live" session ends (ms since epoch), or null if not live. */
    liveUntil: number | null;
    /** "What are you up for?" tags for the current session, e.g. "Coffee". */
    tags: string[];
    oneLiner: string;
    /** Show a fuzzed spot (~300 m) instead of the exact location. */
    approximateLocation: boolean;
  };
};

type SettingsContextValue = StoredSettings & {
  location: PermissionState & { coords: Coords | null };
  /** `available` is false where notifications can't work (Expo Go on Android). */
  notifications: PermissionState & { available: boolean };
  /** True while liveUntil is in the future. */
  isLive: boolean;

  updateProfile: (
    changes: Partial<Omit<StoredSettings["profile"], "onboarded">>,
  ) => void;
  /** Saves the setup answers and unlocks the app. */
  completeOnboarding: (
    profile: Pick<StoredSettings["profile"], "username" | "interests">,
  ) => void;
  updateDiscovery: (changes: Partial<StoredSettings["discovery"]>) => void;
  updateVisibility: (
    changes: Partial<Omit<StoredSettings["visibility"], "liveUntil">>,
  ) => void;
  goLive: (minutes: number, username: string, oneLiner: string) => void;
  goInvisible: () => void;

  /** Shows the OS prompt if allowed, then fetches the position. Returns whether granted. */
  requestLocation: () => Promise<boolean>;
  /** Fetches a fresh position (no prompt). */
  refreshLocation: () => Promise<Coords | null>;
  requestNotifications: () => Promise<boolean>;

  /** Clears saved settings, e.g. on sign-out. */
  resetSettings: () => void;
};

// ---------- Defaults ----------

const defaultSettings: StoredSettings = {
  profile: { username: "", interests: [], onboarded: false },
  discovery: { radiusKm: 1, tags: [] },
  visibility: {
    liveUntil: null,
    tags: [],
    oneLiner: "",
    approximateLocation: true,
  },
};

function toPermissionState(res: {
  status: string;
  canAskAgain: boolean;
}): PermissionState {
  const status =
    res.status === "granted" || res.status === "denied"
      ? res.status
      : "undetermined";
  return { status, canAskAgain: res.canAskAgain };
}

// expo-notifications throws as soon as it's imported in Expo Go on Android
// (push notifications were removed from Expo Go in SDK 53), so it's loaded
// on demand and skipped there. It works in development and production builds.
const notificationsAvailable = !(Platform.OS === "android" && isRunningInExpoGo());

async function loadNotifications() {
  return notificationsAvailable ? import("expo-notifications") : null;
}

const unknownPermission: PermissionState = {
  status: "undetermined",
  canAskAgain: true,
};

// ---------- Provider ----------

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(defaultSettings);
  const [locationPermission, setLocationPermission] =
    useState<PermissionState>(unknownPermission);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<PermissionState>(unknownPermission);
  const [now, setNow] = useState(() => Date.now());

  const [refetch, setRefetch] = useState(false);

  // Save whenever settings change.


  const getSettings=async ()=>{
    api.get<{
      display_name: string|null,
      email: string|null,
      avatar_url: string|null,
      interests: string[] | null,
      onboarded: boolean,
      radius_km: number,
      tags: string[]|null,
      live_until: number|null,
      one_liner: string|null,
      approximate_location: boolean,
      status: string|null,
      can_ask_again: boolean,
      available: boolean,
      is_live: boolean,
      onboarding_completed: boolean,
      onboarding_next_step: string,
    }>("/settings").then((e)=>{
      console.log("called 2", e)
      setSettings({
        discovery: {radiusKm: e.radius_km, tags: e.tags || []},
        visibility: {
          approximateLocation: e.approximate_location,
          liveUntil: e.live_until,
          oneLiner: e.one_liner || "",
          tags: e.tags || []
        },
        profile: {
          username: e.display_name || "",
          interests: e.interests || [],
          onboarded: e.onboarding_completed,
        }
      });

    })
  }
  useEffect(() => {
    getSettings();
  }, [refetch]);

  // Check permissions (without prompting) on start and whenever the app
  // comes back to the foreground — the user may have changed them in the
  // phone's Settings app.
  useEffect(() => {
    async function checkPermissions() {
      const Notifications = await loadNotifications();
      const [loc, notif] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Notifications?.getPermissionsAsync(),
      ]);
      setLocationPermission(toPermissionState(loc));
      if (notif) setNotificationPermission(toPermissionState(notif));
      if (loc.granted) await refreshLocation();
      else setCoords(null);
    }

    checkPermissions().catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkPermissions().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // End the live session automatically when its time runs out.
  const setting = settings?.visibility;
  const isLive = (setting?.liveUntil !== null) && (setting?.liveUntil !== undefined) && (setting?.liveUntil > now);
  useEffect(() => {
    if (setting?.liveUntil === null || setting?.liveUntil === undefined) return;
    const remaining = setting?.liveUntil  - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [setting?.liveUntil]);

  async function refreshLocation() {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: settings.visibility.approximateLocation ? Location.Accuracy.Balanced : Location.Accuracy.Highest,
      });
      const next: Coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      };
      setCoords(next);
      api.post("/location", {
        ...next
      })
      return next;
    } catch {
      // Location services off, or no fix yet.
      return null;
    }
  }

  async function requestLocation() {
    const res = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(toPermissionState(res));
    if (res.granted) await refreshLocation();
    return res.granted;
  }

  async function requestNotifications() {
    const Notifications = await loadNotifications();
    if (!Notifications) return false;
    const res = await Notifications.requestPermissionsAsync();
    setNotificationPermission(toPermissionState(res));
    return res.granted;
  }

  function update<K extends keyof StoredSettings>(
      key: K,
      changes: Partial<StoredSettings[K]>,
  ) {
    const body = (() => {
      switch (key) {
        case "profile": {
          const c = changes as Partial<StoredSettings["profile"]>;
          return {
            ...(c.username !== undefined && { display_name: c.username }),
            ...(c.interests !== undefined && { interests: c.interests }),
            ...(c.onboarded !== undefined && { onboarding_completed: c.onboarded }),
          };
        }

        case "discovery": {
          const c = changes as Partial<StoredSettings["discovery"]>;
          return {
            ...(c.radiusKm !== undefined && { radius_km: c.radiusKm }),
            ...(c.tags !== undefined && { tags: c.tags }),
          };
        }

        case "visibility": {
          const c = changes as Partial<StoredSettings["visibility"]>;
          return {
            ...(c.liveUntil !== undefined && { live_until: c.liveUntil }),
            ...(c.tags !== undefined && { tags: c.tags }),
            ...(c.oneLiner !== undefined && { one_liner: c.oneLiner }),
            ...(c.approximateLocation !== undefined && {
              approximate_location: c.approximateLocation,
            }),
          };
        }
      }
    })();

    return api.post("/settings", body).then(()=>{
      console.log("called")
      setRefetch((e)=> !e);
    });
  }


  const value: SettingsContextValue = {
    ...settings,
    location: { ...locationPermission, coords },
    notifications: { ...notificationPermission, available: notificationsAvailable },
    isLive,

    updateProfile: (changes) => update("profile", changes),
    completeOnboarding: (profile) =>
      update("profile", { ...profile, onboarded: true }),
    updateDiscovery: (changes) => update("discovery", changes),
    updateVisibility: (changes) => update("visibility", changes),
    goLive: (minutes, username, oneLiner) => {
      setNow(Date.now());
      api.post("/settings", {
        live_until:  Date.now() + minutes * 60_000,
        one_liner: oneLiner,
        username
      }).then(()=>{
        console.log("called")
        setRefetch((e)=> !e);
      });
    },
    goInvisible: () => update("visibility", { liveUntil: 0 }),

    requestLocation,
    refreshLocation,
    requestNotifications,

    resetSettings: () => setSettings(defaultSettings),
  };

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
