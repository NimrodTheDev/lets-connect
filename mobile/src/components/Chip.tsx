import { Check } from "lucide-react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius } from "@/constants/theme";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

// Toggleable tag, e.g. "Coffee" in "What are you up for?".
export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {selected && <Check size={16} strokeWidth={2.5} color={colors.onPrimary} />}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  labelSelected: {
    color: colors.onPrimary,
  },
});
