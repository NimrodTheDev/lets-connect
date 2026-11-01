import { Stack } from "expo-router";

import { colors } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SettingsProvider, useSettings } from "@/lib/settings";

function RootNavigator() {
  const { isLoggedIn } = useAuth();
  const { profile } = useSettings();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={isLoggedIn}>
        {/* First login: finish setup before anything else. */}
        <Stack.Protected guard={!profile.onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={profile.onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" options={{ presentation: "modal" }} />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <RootNavigator />
      </SettingsProvider>
    </AuthProvider>
  );
}
