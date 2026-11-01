import { Tabs } from "expo-router";
import { Bell, MapPin, MessageSquare, Video } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabIcon } from "@/components/TabIcon";
import { colors } from "@/constants/theme";

// Height of the icon pill + label, not counting the device's bottom inset.
const TAB_BAR_CONTENT_HEIGHT = 64;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 30,
        },
        tabBarIconStyle: { width: 56, height: 32 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600", marginTop: 4 },
        tabBarBadgeStyle: { backgroundColor: colors.primary },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon icon={MapPin} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="meet"
        options={{
          title: "Meet",
          tabBarIcon: ({ focused }) => <TabIcon icon={Video} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={MessageSquare} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ focused }) => <TabIcon icon={Bell} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
