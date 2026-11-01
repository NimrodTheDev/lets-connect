import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";

type Props = {
  children: ReactNode;
  /**
   * Which sides keep clear of the notch / status bar / home indicator.
   * Defaults to everything except the bottom, because inside the tabs the
   * tab bar already sits above the home indicator. Pass [] for full-bleed
   * screens like the map, or include "bottom" on screens without a tab bar.
   */
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  edges = ["top", "left", "right"],
  style,
}: Props) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
