import { router } from "expo-router";
import {
  Bell,
  EyeOff,
  LogOut,
  MapPin,
  X,
  type LucideIcon,
} from "lucide-react-native";
import {useState, type ReactNode, useEffect} from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/Chip";
import { SegmentedControl } from "@/components/SegmentedControl";
import { PRESET_TAGS } from "@/constants/tags";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { useSettings, type PermissionState } from "@/lib/settings";
import {api} from "@/lib/api";

const VISIBLE_FOR_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
];

const RADIUS_OPTIONS = [
  { value: 0.5, label: "500 m" },
  { value: 1, label: "1 km" },
  { value: 3, label: "3 km" },
  { value: 5, label: "5 km" },
];

function toggle(list: string[], tag: string) {
  return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const settings = useSettings();
  const { profile, discovery, visibility, location, notifications, isLive } = settings;

  const [visibleFor, setVisibleFor] = useState(60);
  const [goLiveError, setGoLiveError] = useState<string | null>(null);
  const [oneLiner, setOneLiner] = useState("");
  const [username, setUsername] = useState("");

  async function handleGoLive() {
    // Going live puts you on the map, so it needs a location first.
    const granted =
      location.status === "granted" || (await settings.requestLocation());
    if (!granted) {
      setGoLiveError("Allow location access to show yourself on the map.");
      return;
    }
    setGoLiveError(null);
    settings.goLive(visibleFor, username, oneLiner);
  }

  useEffect(() => {
    setOneLiner(visibility.oneLiner);
    setUsername(profile.username);
  }, [visibility.oneLiner, profile.username]);

  useEffect(() => {
    if (!isLive) return;

    const ping = () => {
      api.post("/live", {
        last_seen_at: Math.floor(Date.now() / 1000),
      });
    };

    ping(); // Ping immediately

    const interval = setInterval(ping, 30_000);

    return () => clearInterval(interval);
  }, [isLive]);


  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          // iOS shows this as a card below the status bar; Android draws it full screen.
          paddingTop: Platform.OS === "ios" ? 24 : insets.top + 16,
          paddingBottom: insets.bottom + 32,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          hitSlop={8}
        >
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* ---------- Visibility ---------- */}
      <Section title="Show yourself on the map">
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, isLive && styles.statusDotLive]} />
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>
              {isLive ? "You're live" : "You're invisible"}
            </Text>
            <Text style={styles.statusText}>
              {isLive && visibility.liveUntil
                ? `Visible until ${formatTime(visibility.liveUntil)}`
                : "People nearby can't see you right now."}
            </Text>
          </View>
        </View>

        <Label>Visible for</Label>
        <SegmentedControl
          options={VISIBLE_FOR_OPTIONS}
          value={visibleFor}
          onChange={setVisibleFor}
        />

        {/*<Label>What are you up for?</Label>*/}
        {/*<ChipGroup*/}
        {/*  selected={visibility.tags}*/}
        {/*  onToggle={(tag) =>*/}
        {/*    settings.updateVisibility({ tags: toggle(visibility.tags, tag) })*/}
        {/*  }*/}
        {/*/>*/}

        <Label>
          One-liner <Text style={styles.optional}>(optional)</Text>
        </Label>
        <TextInput
          style={styles.input}
          value={oneLiner}
          onChangeText={setOneLiner}
          placeholder="e.g. Working from a cafe till 5"
          placeholderTextColor={colors.textMuted}
          maxLength={80}
        />

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Approximate location</Text>
            <Text style={styles.rowText}>
              Recommended. Turn off to share your exact spot.
            </Text>
          </View>
          <Switch
            value={visibility.approximateLocation}
            onValueChange={(approximateLocation) =>
              settings.updateVisibility({ approximateLocation })
            }
            trackColor={{ true: colors.success, false: colors.border }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.border}
          />
        </View>

        {goLiveError && <Text style={styles.error}>{goLiveError}</Text>}

        <Pressable
          onPress={handleGoLive}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>
            {isLive ? "Update & stay live" : "Go live"}
          </Text>
        </Pressable>

        {isLive && (
          <Pressable
            onPress={settings.goInvisible}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <EyeOff size={18} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Go invisible now</Text>
          </Pressable>
        )}
      </Section>

      {/* ---------- Discovery ---------- */}
      <Section title="Who you see">
        <Label>Distance</Label>
        <SegmentedControl
          options={RADIUS_OPTIONS}
          value={discovery.radiusKm}
          onChange={(radiusKm) => settings.updateDiscovery({ radiusKm })}
        />

        <Label>Only show people into</Label>
        <Text style={styles.hint}>
          {discovery.tags.length === 0
            ? "Showing everyone. Pick tags to narrow it down."
            : "Showing people with at least one of these."}
        </Text>
        <ChipGroup
          selected={discovery.tags}
          onToggle={(tag) =>
            settings.updateDiscovery({ tags: toggle(discovery.tags, tag) })
          }
        />
      </Section>

      {/* ---------- Profile ---------- */}
      <Section title="Profile">
        <Label>Username</Label>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="What should people call you?"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
        />

        <Label>Interests</Label>
        <ChipGroup
          selected={profile.interests}
          onToggle={(tag) =>
            settings.updateProfile({ interests: toggle(profile.interests, tag) })
          }
        />
      </Section>

      {/* ---------- Permissions ---------- */}
      <Section title="Permissions">
        <PermissionRow
          icon={MapPin}
          title="Location"
          description="To find people nearby and place you on the map."
          permission={location}
          onRequest={settings.requestLocation}
        />
        <PermissionRow
          icon={Bell}
          title="Notifications"
          description={
            notifications.available
              ? "For new requests and messages."
              : "Not available in Expo Go on Android. Use a development build."
          }
          permission={notifications}
          onRequest={settings.requestNotifications}
          disabled={!notifications.available}
        />
      </Section>

      <Pressable
        onPress={signOut}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <LogOut size={18} color={colors.primary} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

// ---------- Pieces ----------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ChipGroup({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {PRESET_TAGS.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          selected={selected.includes(tag)}
          onPress={() => onToggle(tag)}
        />
      ))}
    </View>
  );
}

function PermissionRow({
  icon: Icon,
  title,
  description,
  permission,
  onRequest,
  disabled = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  permission: PermissionState;
  onRequest: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const granted = permission.status === "granted";
  // Once the user has refused and the OS won't prompt again, only the
  // phone's Settings app can turn it back on.
  const action =
    granted || disabled
      ? null
      : permission.canAskAgain
        ? { label: "Allow", onPress: () => void onRequest() }
        : { label: "Open Settings", onPress: () => void Linking.openSettings() };

  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionIcon}>
        <Icon size={20} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowText}>{description}</Text>
      </View>
      {disabled ? null : action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
        >
          <Text style={styles.smallButtonText}>{action.label}</Text>
        </Pressable>
      ) : (
        <View style={styles.onBadge}>
          <Text style={styles.onBadgeText}>On</Text>
        </View>
      )}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.segmentBg,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  label: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  optional: {
    fontWeight: "400",
    color: colors.textMuted,
  },
  hint: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 14,
    color: colors.textMuted,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.segmentBg,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textMuted,
  },
  statusDotLive: {
    backgroundColor: colors.success,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  statusText: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 22,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  rowText: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  error: {
    marginTop: 14,
    fontSize: 14,
    color: colors.primary,
  },
  primaryButton: {
    height: 56,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  secondaryButton: {
    flexDirection: "row",
    gap: 8,
    height: 52,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  pressed: {
    opacity: 0.8,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permissionIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
  },
  smallButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  onBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  onBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.success,
  },
  signOut: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    marginTop: 36,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
});
