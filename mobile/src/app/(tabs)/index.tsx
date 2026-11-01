import { Link } from "expo-router";
import { MapPin, SlidersHorizontal, Video } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { colors, radius } from "@/constants/theme";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import MapScreen from "@/components/MapScreen";

type NearbyPerson = {
  username: string | null;
  distance: number | null;
  interests: string[] | null;
  avatar_url: string | null;
  one_liner: string | null;
  live_until: number | null;
};

function formatDistance(value: number | null) {
  if (value == null) return "Nearby";
  const meters = Math.max(1, Math.round(value));
  if (meters < 1000) return `About ${meters} m away`;
  return `About ${(meters / 1000).toFixed(1)} km away`;
}

function formatMinutes(value: number | null) {
  if (value == null) return "Recently active";
  const remaining = Math.max(1, Math.round((value - Date.now()) / 60000));
  return `Around for the next ${remaining} min`;
}

function initials(name: string | null) {
  const base = name?.trim() || "You";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "Y";
}

export default function Index() {
  const { discovery } = useSettings();
  const [visible, setVisible] = useState<NearbyPerson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPeople() {
      try {
        setLoading(true);
        const people = await api.get<NearbyPerson[]>("/location");
        if (!cancelled) setVisible(people);
      } catch {
        if (!cancelled) setVisible([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPeople();
    const interval = setInterval(() => {
      void loadPeople();
    }, 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const tagPool = useMemo(
    () => Array.from(new Set(visible.flatMap((person) => person.interests ?? []).slice(0, 4))),
    [visible],
  );

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Nearby</Text>
        <Link href="/settings" asChild>
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <SlidersHorizontal size={22} color={colors.text} />
          </Pressable>
        </Link>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryText}>
            {loading ? "Checking nearby" : `${visible.length} people nearby`}
          </Text>
          <Text style={styles.summaryMuted}>within {discovery.radiusKm} km</Text>
        </View>

        <View style={styles.tagRow}>
          {tagPool.length > 0 ? (
            tagPool.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tag}>
              <Text style={styles.tagText}>Open to meet</Text>
            </View>
          )}
          {visible.length > tagPool.length && (
            <View style={styles.moreTag}>
              <Text style={styles.moreTagText}>+{visible.length - tagPool.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.mapPanel}>
          <MapScreen/>
        </View>
        {visible.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin size={18} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              No one is nearby yet. Go live to appear on the map.
            </Text>
          </View>
        ) : (
          visible.map((person) => (
            <View key={`${person.username ?? "user"}-${person.distance ?? "d"}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>{initials(person.username)}</Text>
                </View>

                <View style={styles.headerInfo}>
                  <Text style={styles.name}>{person.username || "Nearby person"}</Text>
                  <Text style={styles.distance}>{formatDistance(person.distance)}</Text>
                </View>
              </View>

              <View style={styles.chipGroup}>
                {(person.interests ?? []).slice(0, 4).map((interest) => (
                  <View key={`${person.username}-${interest}`} style={styles.inlineChip}>
                    <Text style={styles.inlineChipText}>{interest}</Text>
                  </View>
                ))}
              </View>

              {person.one_liner ? <Text style={styles.oneLiner}>{person.one_liner}</Text> : null}

              <Text style={styles.liveStatus}>{formatMinutes(person.live_until)}</Text>

              <View style={styles.ctaRow}>
                <Pressable style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Say hi</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton}>
                  <Video size={16} color={colors.text} />
                  <Text style={styles.secondaryButtonText}>Video call</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.segmentBg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  summaryMuted: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  moreTag: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  moreTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  mapPanel: {
    position: "relative",
    height: 180,
    borderRadius: 28,
    backgroundColor: colors.map,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapTopGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    top: -40,
    right: -20,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  mapDotLeft: {
    position: "absolute",
    width: 110,
    height: 110,
    left: 24,
    top: 34,
    borderRadius: 55,
    backgroundColor: colors.mapPark,
  },
  mapDotRight: {
    position: "absolute",
    width: 140,
    height: 140,
    right: 18,
    bottom: 12,
    borderRadius: 70,
    backgroundColor: colors.mapStreet,
    opacity: 0.8,
  },
  mapDotCenter: {
    position: "absolute",
    width: 84,
    height: 84,
    left: 160,
    top: 62,
    borderRadius: 42,
    backgroundColor: colors.mapStreet,
    opacity: 0.75,
  },
  mapUserPill: {
    position: "absolute",
    right: 20,
    top: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapUserText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  distance: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  inlineChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.segmentBg,
  },
  inlineChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  oneLiner: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginBottom: 8,
  },
  liveStatus: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
    marginBottom: 14,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.segmentBg,
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});
