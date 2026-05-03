import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { Platform } from "react-native"

import { colors } from "@/constants/fitforgeTheme"

type TabIconName =
  | "home"
  | "home-outline"
  | "barbell"
  | "barbell-outline"
  | "stats-chart"
  | "stats-chart-outline"
  | "person"
  | "person-outline"

function triggerTabHaptic() {
  if (Platform.OS !== "web") {
    Haptics.selectionAsync().catch(() => {})
  }
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 76,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarItemStyle: {
          borderRadius: 18,
        },
        lazy: false,
      }}
      screenListeners={{
        tabPress: () => {
          triggerTabHaptic()
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? "home" : "home-outline") as TabIconName}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workout",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? "barbell" : "barbell-outline") as TabIconName}
              size={23}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? "stats-chart" : "stats-chart-outline") as TabIconName}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? "person" : "person-outline") as TabIconName}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  )
}