import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { colors, radius } from "@/constants/theme";

type Props = {
  icon: LucideIcon;
  focused: boolean;
};

// Tab bar icon with the soft orange pill behind it when the tab is active.
export function TabIcon({ icon: Icon, focused }: Props) {
  return (
    <View style={[styles.pill, focused && styles.pillFocused]}>
      <Icon
        size={22}
        strokeWidth={focused ? 2.25 : 2}
        color={focused ? colors.primary : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 56,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  pillFocused: {
    backgroundColor: colors.primarySoft,
  },
});
