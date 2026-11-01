import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";

type Option<T> = { value: T; label: string };

type Props<T> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

// Pill-shaped single choice, e.g. "30 min | 1 hour | 3 hours".
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.item, selected && styles.itemSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.segmentBg,
  },
  item: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  itemSelected: {
    backgroundColor: colors.text,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textMuted,
  },
  labelSelected: {
    color: colors.onPrimary,
  },
});
