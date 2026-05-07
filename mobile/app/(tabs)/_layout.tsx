import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";

import { colors } from "@/constants/fitforgeTheme";

type TabIconName =
  | "home"
  | "home-outline"
  | "barbell"
  | "barbell-outline"
  | "stats-chart"
  | "stats-chart-outline"
  | "person"
  | "person-outline";

function triggerTabHaptic() {
  if (Platform.OS !== "web") {
    Haptics.selectionAsync().catch(() => {});
  }
}

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "android" ? 104 : 76,
          paddingTop: 8,
          paddingBottom: Platform.OS === "android" ? 40 : 12,
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
          triggerTabHaptic();
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
        name="food"
        options={{
          title: "Food",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "nutrition" : "nutrition-outline"}
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
              name={
                (focused ? "stats-chart" : "stats-chart-outline") as TabIconName
              }
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
        name="weight"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="steps"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
