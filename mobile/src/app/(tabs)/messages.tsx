import { StyleSheet, Text } from "react-native";

import { Screen } from "@/components/Screen";
import { colors } from "@/constants/theme";

export default function MessagesScreen() {
  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>Messages</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
});
