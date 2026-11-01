import { StyleSheet, View, type DimensionValue } from "react-native";

import { colors } from "@/constants/theme";

// Decorative map with avatars for the top of the login screen.
// Built from plain Views so it needs no extra libraries.

type AvatarProps = {
  top: DimensionValue;
  left: DimensionValue;
  size: number;
  bg: string;
  shirt: string;
  highlight?: boolean;
};

function Avatar({ top, left, size, bg, shirt, highlight }: AvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        {
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: highlight ? colors.primary : colors.surface,
          borderWidth: highlight ? 4 : 3,
          transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
        },
      ]}
    >
      <View
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: size,
          backgroundColor: "#6B4226",
          marginTop: size * 0.18,
        }}
      />
      <View
        style={{
          width: size * 0.64,
          height: size * 0.5,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          backgroundColor: shirt,
          marginTop: size * 0.04,
        }}
      />
    </View>
  );
}

type MapHeaderProps = {
  /** Space taken by the status bar; the map fills it, the people sit below it. */
  topInset?: number;
};

export function MapHeader({ topInset = 0 }: MapHeaderProps) {
  return (
    <View style={[styles.map, { height: MAP_HEIGHT + topInset }]}>
      {/* Parks */}
      <View style={[styles.park, { left: "32%", top: 0, width: "22%", height: "70%" }]} />
      <View style={[styles.park, { left: "64%", top: "78%", width: "16%", height: "40%" }]} />

      {/* Streets */}
      {(["26%", "62%"] as const).map((top) => (
        <View key={top} style={[styles.hStreet, { top }]} />
      ))}
      {(["12%", "28%", "56%", "72%", "88%"] as const).map((left) => (
        <View key={left} style={[styles.vStreet, { left }]} />
      ))}

      {/* People */}
      <View style={[styles.people, { top: topInset }]}>
      <Avatar top="40%" left="17%" size={48} bg="#F3C9A5" shirt="#3B4BA0" />
      <Avatar top="80%" left="22%" size={42} bg="#E6C4E4" shirt="#3B4BA0" />
      <Avatar top="50%" left="50%" size={72} bg="#F6DE9C" shirt="#7A2E5A" highlight />
      <Avatar top="35%" left="82%" size={48} bg="#BFD9DD" shirt="#1F7A4A" />
      <Avatar top="75%" left="79%" size={42} bg="#D5E7CF" shirt="#1E1A2B" />
      </View>
    </View>
  );
}

const MAP_HEIGHT = 260;

const styles = StyleSheet.create({
  map: {
    backgroundColor: colors.map,
    overflow: "hidden",
  },
  park: {
    position: "absolute",
    backgroundColor: colors.mapPark,
    borderRadius: 10,
  },
  hStreet: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: colors.mapStreet,
  },
  vStreet: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: colors.mapStreet,
  },
  people: {
    position: "absolute",
    left: 0,
    right: 0,
    height: MAP_HEIGHT,
  },
  avatar: {
    position: "absolute",
    alignItems: "center",
    overflow: "hidden",
  },
});
