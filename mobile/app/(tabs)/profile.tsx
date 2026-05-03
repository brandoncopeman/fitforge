import { Ionicons } from "@expo/vector-icons"
import { useClerk, useUser } from "@clerk/clerk-expo"
import { router } from "expo-router"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import { colors, spacing } from "@/constants/fitforgeTheme"

export default function ProfileScreen() {
  const { signOut } = useClerk()
  const { user } = useUser()

  async function handleSignOut() {
    await signOut()
    router.replace("/(auth)/sign-in")
  }

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "FitForge User"

  const initial = displayName[0]?.toUpperCase() || "F"

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Account and app settings</Text>

        <FitCard>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>

            <View style={styles.profileText}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>
                {user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
              </Text>
            </View>
          </View>
        </FitCard>

        <FitCard>
          <SettingRow icon="person-outline" label="Account" value="Soon" />
          <SettingRow icon="notifications-outline" label="Notifications" value="Soon" />
          <SettingRow icon="shield-checkmark-outline" label="Privacy" value="Soon" />
          <SettingRow icon="trash-outline" label="Delete account" value="Web for now" danger />
        </FitCard>

        <FitCard accent onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </FitCard>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingRow({
  icon,
  label,
  value,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.red : colors.textMuted}
        />
        <Text style={[styles.settingLabel, danger && styles.dangerText]}>
          {label}
        </Text>
      </View>

      <Text style={styles.settingValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.tealDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  profileText: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  email: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  settingRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  settingLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  settingValue: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  dangerText: {
    color: colors.red,
  },
  signOutText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
})