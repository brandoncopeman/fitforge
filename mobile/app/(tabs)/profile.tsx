import { Ionicons } from "@expo/vector-icons"
import { useAuth, useClerk, useUser } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { router } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import StatTile from "@/components/StatTile"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"
import {
  deleteMobileAccount,
  getMobileProfile,
  saveMobileProfileCore,
  updateMobileProfileSettings,
} from "@/lib/api"
import { MobileProfile } from "@/types/profile"

type SavingStatus = "idle" | "saving" | "saved" | "error"

function triggerLightHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

function triggerMediumHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  }
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatNumber(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback

  return Math.round(parsed).toLocaleString()
}

function formatWeight(value: unknown) {
  const number = toNumber(value, 0)
  if (number <= 0) return "—"
  return `${number}kg`
}

function normalizeDecimalInput(value: string) {
  const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "")
  const firstDotIndex = cleaned.indexOf(".")

  if (firstDotIndex === -1) {
    return cleaned
  }

  return (
    cleaned.slice(0, firstDotIndex + 1) +
    cleaned.slice(firstDotIndex + 1).replace(/\./g, "")
  )
}

function normalizeIntegerInput(value: string) {
  return value.replace(/[^0-9]/g, "")
}

function getGoalLabel(goal: string | null | undefined) {
  if (goal === "cut") return "Cut"
  if (goal === "bulk") return "Bulk"
  if (goal === "maintain") return "Maintain"
  return "Not set"
}

export default function ProfileScreen() {
  const { getToken } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()

  const [profile, setProfile] = useState<MobileProfile | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [goalWeight, setGoalWeight] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingStatus, setSavingStatus] = useState<SavingStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const saveNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveGoalWeightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const latestProfileRef = useRef<MobileProfile | null>(null)

  useEffect(() => {
    latestProfileRef.current = profile
  }, [profile])

  const loadProfile = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(!profile)
        }

        setError(null)

        const response = await getMobileProfile(getToken)
        const nextProfile = response.profile

        setProfile(nextProfile)
        latestProfileRef.current = nextProfile

        setDisplayName(
          nextProfile?.display_name ||
            user?.fullName ||
            user?.primaryEmailAddress?.emailAddress ||
            "FitForge User"
        )

        setGoalWeight(
          nextProfile?.goal_weight_kg === null ||
            nextProfile?.goal_weight_kg === undefined
            ? ""
            : String(nextProfile.goal_weight_kg)
        )
      } catch (err) {
        console.warn("Failed to load profile", err)
        setError(err instanceof Error ? err.message : "Failed to load profile")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken, profile, user?.fullName, user?.primaryEmailAddress?.emailAddress]
  )

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (saveNameTimerRef.current) {
        clearTimeout(saveNameTimerRef.current)
      }

      if (saveGoalWeightTimerRef.current) {
        clearTimeout(saveGoalWeightTimerRef.current)
      }
    }
  }, [])

  async function handleSignOut() {
    await signOut()
    router.replace("/(auth)/sign-in")
  }

  function openDeleteModal() {
    triggerLightHaptic()
    setDeleteConfirmation("")
    setDeleteError(null)
    setDeleteModalVisible(true)
  }

  function closeDeleteModal() {
    if (deletingAccount) return

    setDeleteConfirmation("")
    setDeleteError(null)
    setDeleteModalVisible(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation.trim() !== "DELETE" || deletingAccount) return

    Alert.alert(
      "Delete account permanently?",
      "This will permanently delete your FitForge account and app data. This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingAccount(true)
              setDeleteError(null)

              await deleteMobileAccount(getToken, "DELETE")

              await signOut()
              router.replace("/(auth)/sign-in")
            } catch (err) {
              console.warn("Failed to delete account", err)
              setDeleteError(
                err instanceof Error
                  ? err.message
                  : "Failed to delete account"
              )
            } finally {
              setDeletingAccount(false)
            }
          },
        },
      ]
    )
  }

  function scheduleDisplayNameSave(value: string) {
    if (saveNameTimerRef.current) {
      clearTimeout(saveNameTimerRef.current)
    }

    saveNameTimerRef.current = setTimeout(() => {
      saveNameTimerRef.current = null
      saveDisplayName(value).catch((err: unknown) => {
        console.warn("Failed to save display name", err)
      })
    }, 600)
  }

  async function saveDisplayName(value: string) {
    const current = latestProfileRef.current

    if (!current) return

    const safeName = value.trim() || "FitForge User"

    const weight = toNumber(current.weight_kg, 0)
    const height = toNumber(current.height_cm, 0)
    const age = toNumber(current.age, 0)
    const sex = current.sex || ""
    const activityLevel = current.activity_level || ""
    const goal = current.goal || ""

    if (!weight || !height || !age || !sex || !activityLevel || !goal) {
      return
    }

    try {
      setSavingStatus("saving")

      const response = await saveMobileProfileCore(getToken, {
        display_name: safeName,
        weight_kg: weight,
        height_cm: height,
        age,
        sex,
        activity_level: activityLevel,
        goal,
        daily_step_target: toNumber(current.daily_step_target, 8000),
        weekly_workout_target: toNumber(current.weekly_workout_target, 3),
      })

      setProfile((existing) =>
        existing
          ? {
              ...existing,
              display_name: safeName,
              daily_calorie_target: response.daily_calories,
              daily_protein_target: response.daily_protein,
            }
          : existing
      )

      setSavingStatus("saved")
    } catch (err) {
      console.warn("Failed to save display name", err)
      setSavingStatus("error")
      setError(err instanceof Error ? err.message : "Failed to save profile")
    }
  }

  function updateDisplayName(value: string) {
    setDisplayName(value)
    setSavingStatus("saving")
    scheduleDisplayNameSave(value)
  }

  function updateGoalWeight(value: string) {
    const cleaned = normalizeDecimalInput(value)
    setGoalWeight(cleaned)
    setSavingStatus("saving")

    if (saveGoalWeightTimerRef.current) {
      clearTimeout(saveGoalWeightTimerRef.current)
    }

    saveGoalWeightTimerRef.current = setTimeout(() => {
      saveGoalWeightTimerRef.current = null

      const nextGoalWeight = cleaned.trim() === "" ? null : Number(cleaned)

      updateMobileProfileSettings(getToken, {
        goal_weight_kg:
          nextGoalWeight !== null && Number.isFinite(nextGoalWeight)
            ? nextGoalWeight
            : null,
      })
        .then(() => {
          setProfile((existing) =>
            existing
              ? {
                  ...existing,
                  goal_weight_kg:
                    nextGoalWeight !== null && Number.isFinite(nextGoalWeight)
                      ? nextGoalWeight
                      : existing.goal_weight_kg,
                }
              : existing
          )

          setSavingStatus("saved")
        })
        .catch((err: unknown) => {
          console.warn("Failed to save goal weight", err)
          setSavingStatus("error")
          setError(
            err instanceof Error ? err.message : "Failed to save goal weight"
          )
        })
    }, 600)
  }

  function updateDailyStepTarget(value: string) {
    const cleaned = normalizeIntegerInput(value)
    const current = latestProfileRef.current
    if (!current) return

    const nextProfile = {
      ...current,
      daily_step_target: cleaned === "" ? 0 : Number(cleaned),
    }

    setProfile(nextProfile)
    latestProfileRef.current = nextProfile
  }

  function updateWeeklyWorkoutTarget(value: string) {
    const cleaned = normalizeIntegerInput(value)
    const current = latestProfileRef.current
    if (!current) return

    const nextProfile = {
      ...current,
      weekly_workout_target: cleaned === "" ? 0 : Number(cleaned),
    }

    setProfile(nextProfile)
    latestProfileRef.current = nextProfile
  }

  async function saveTargets() {
    const current = latestProfileRef.current
    if (!current) return

    const weight = toNumber(current.weight_kg, 0)
    const height = toNumber(current.height_cm, 0)
    const age = toNumber(current.age, 0)
    const sex = current.sex || ""
    const activityLevel = current.activity_level || ""
    const goal = current.goal || ""

    if (!weight || !height || !age || !sex || !activityLevel || !goal) {
      setError("Finish profile setup before saving targets.")
      return
    }

    try {
      triggerMediumHaptic()
      setSavingStatus("saving")
      setError(null)

      const response = await saveMobileProfileCore(getToken, {
        display_name: displayName.trim() || current.display_name || "FitForge User",
        weight_kg: weight,
        height_cm: height,
        age,
        sex,
        activity_level: activityLevel,
        goal,
        daily_step_target: toNumber(current.daily_step_target, 8000),
        weekly_workout_target: toNumber(current.weekly_workout_target, 3),
      })

      setProfile((existing) =>
        existing
          ? {
              ...existing,
              daily_calorie_target: response.daily_calories,
              daily_protein_target: response.daily_protein,
            }
          : existing
      )

      setSavingStatus("saved")
    } catch (err) {
      console.warn("Failed to save targets", err)
      setSavingStatus("error")
      setError(err instanceof Error ? err.message : "Failed to save targets")
    }
  }

  function toggleShowWeightOnHome(value: boolean) {
    triggerLightHaptic()

    const previous = latestProfileRef.current
    if (!previous) return

    const nextProfile = {
      ...previous,
      show_weight_on_home: value,
    }

    setProfile(nextProfile)
    latestProfileRef.current = nextProfile
    setSavingStatus("saving")

    updateMobileProfileSettings(getToken, {
      show_weight_on_home: value,
    })
      .then(() => {
        setSavingStatus("saved")
      })
      .catch((err: unknown) => {
        console.warn("Failed to update home preference", err)
        setProfile(previous)
        latestProfileRef.current = previous
        setSavingStatus("error")
        setError(
          err instanceof Error ? err.message : "Failed to update setting"
        )
      })
  }

  const displayNameFromAccount =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "FitForge User"

  const shownName = displayName || profile?.display_name || displayNameFromAccount
  const initial = shownName[0]?.toUpperCase() || "F"

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            tintColor={colors.teal}
          />
        }
      >
        <View>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Account and app settings</Text>
        </View>

        {error ? (
          <FitCard>
            <Text selectable style={styles.inlineError}>
              {error}
            </Text>

            <Pressable
              onPress={() => loadProfile()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </FitCard>
        ) : null}

        <FitCard>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>

            <View style={styles.profileText}>
              <TextInput
                value={displayName}
                onChangeText={updateDisplayName}
                placeholder="Display name"
                placeholderTextColor={colors.textFaint}
                style={styles.nameInput}
              />

              <Text style={styles.email}>
                {user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
              </Text>

              <Text style={styles.statusText}>
                {savingStatus === "saving"
                  ? "Saving..."
                  : savingStatus === "saved"
                  ? "Saved"
                  : savingStatus === "error"
                  ? "Save failed"
                  : "Ready"}
              </Text>
            </View>
          </View>
        </FitCard>

        <View style={styles.tileRow}>
          <StatTile
            label="Calories"
            value={formatNumber(profile?.daily_calorie_target)}
            detail="daily target"
            accent
          />
          <StatTile
            label="Protein"
            value={`${formatNumber(profile?.daily_protein_target)}g`}
            detail="daily target"
          />
        </View>

        <View style={styles.tileRow}>
          <StatTile
            label="Steps"
            value={formatNumber(profile?.daily_step_target)}
            detail="daily target"
          />
          <StatTile
            label="Workouts"
            value={formatNumber(profile?.weekly_workout_target)}
            detail="weekly target"
            accent
          />
        </View>

        <FitCard>
          <Text style={styles.cardTitle}>Targets</Text>
          <Text style={styles.cardText}>
            These targets are used across Home, food tracking, steps, and weekly
            workout progress.
          </Text>

          <View style={styles.inputGrid}>
            <ProfileNumberInput
              label="Daily steps"
              value={String(profile?.daily_step_target ?? "")}
              onChange={updateDailyStepTarget}
            />

            <ProfileNumberInput
              label="Weekly workouts"
              value={String(profile?.weekly_workout_target ?? "")}
              onChange={updateWeeklyWorkoutTarget}
            />
          </View>

          <Pressable
            onPress={saveTargets}
            style={({ pressed }) => [
              styles.saveButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.saveButtonText}>Save Targets</Text>
          </Pressable>
        </FitCard>

        <FitCard>
          <Text style={styles.cardTitle}>Body & Goal</Text>

          <SettingRow
            icon="scale-outline"
            label="Current weight"
            value={formatWeight(profile?.weight_kg)}
          />

          <SettingRow
            icon="flag-outline"
            label="Goal"
            value={getGoalLabel(profile?.goal)}
          />

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Goal weight</Text>
            <View style={styles.inputValueRow}>
              <TextInput
                value={goalWeight}
                onChangeText={updateGoalWeight}
                placeholder="Optional"
                placeholderTextColor={colors.textFaint}
                keyboardType={
                  Platform.OS === "ios" ? "decimal-pad" : "numeric"
                }
                style={styles.inlineInput}
              />
              <Text style={styles.inputSuffix}>kg</Text>
            </View>
          </View>
        </FitCard>

        <FitCard>
          <Text style={styles.cardTitle}>Preferences</Text>

          <View style={styles.toggleRow}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="home-outline"
                size={20}
                color={colors.textMuted}
              />
              <View>
                <Text style={styles.settingLabel}>Show weight on Home</Text>
                <Text style={styles.settingHint}>
                  Switches the Home progress card preference.
                </Text>
              </View>
            </View>

            <Switch
              value={Boolean(profile?.show_weight_on_home)}
              onValueChange={toggleShowWeightOnHome}
            />
          </View>
        </FitCard>

        <FitCard>
          <Text style={styles.cardTitle}>App</Text>

          <SettingRow icon="barbell-outline" label="FitForge Mobile" value="v1" />
          <SettingRow icon="phone-portrait-outline" label="Platform" value={Platform.OS} />
          <SettingRow icon="shield-checkmark-outline" label="Privacy" value="Web settings" />

          <Pressable
            onPress={openDeleteModal}
            style={({ pressed }) => [
              styles.deleteRow,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="trash-outline" size={20} color={colors.red} />
              <Text style={[styles.settingLabel, styles.dangerText]}>
                Delete account
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        </FitCard>

        <FitCard accent onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </FitCard>
      </ScrollView>

      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete account</Text>

              <Pressable
                onPress={closeDeleteModal}
                disabled={deletingAccount}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.warningTitle}>This cannot be undone.</Text>

            <Text style={styles.warningText}>
              This permanently deletes your FitForge profile, workouts,
              templates, food logs, steps, weight logs, goals, progress history,
              and account access.
            </Text>

            <Text style={styles.confirmLabel}>Type DELETE to confirm</Text>

            <TextInput
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={colors.textFaint}
              editable={!deletingAccount}
              style={styles.deleteInput}
            />

            {deleteError ? (
              <Text selectable style={styles.deleteError}>
                {deleteError}
              </Text>
            ) : null}

            <Pressable
              onPress={handleDeleteAccount}
              disabled={
                deleteConfirmation.trim() !== "DELETE" || deletingAccount
              }
              style={[
                styles.deleteButton,
                (deleteConfirmation.trim() !== "DELETE" || deletingAccount) &&
                  styles.deleteButtonDisabled,
              ]}
            >
              {deletingAccount ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.deleteButtonText}>
                  Delete my account forever
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={closeDeleteModal}
              disabled={deletingAccount}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

function ProfileNumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        selectTextOnFocus
        style={styles.input}
      />
    </View>
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
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: spacing.md,
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
    marginTop: 2,
  },
  inlineError: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  retryButton: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  retryText: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
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
  nameInput: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    padding: 0,
  },
  email: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  statusText: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5,
  },
  tileRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  cardText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  inputGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  inputBox: {
    flex: 1,
    minHeight: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  input: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    padding: 0,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900",
  },
  settingRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  deleteRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  settingLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  settingHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 220,
  },
  settingValue: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  dangerText: {
    color: colors.red,
  },
  fieldBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  inputValueRow: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  inlineInput: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    padding: 0,
  },
  inputSuffix: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  toggleRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  signOutText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  modalCloseButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  warningTitle: {
    color: colors.red,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  warningText: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  confirmLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  deleteInput: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  deleteError: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  deleteButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  deleteButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  cancelButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "900",
  },
})