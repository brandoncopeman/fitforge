import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { router } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"
import { getMobileWorkoutHistory } from "@/lib/api"
import { MobileWorkoutHistoryItem } from "@/types/workoutHistory"

function triggerLightHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown date"
  }

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDuration(minutes: number | null) {
  if (!minutes || minutes <= 0) return "—"
  return `${minutes} min`
}

function formatVolume(volume: number) {
  if (!Number.isFinite(volume) || volume <= 0) return "0 kg"
  return `${Math.round(volume).toLocaleString()} kg`
}

export default function WorkoutHistoryScreen() {
  const { getToken } = useAuth()

  const [workouts, setWorkouts] = useState<MobileWorkoutHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalWorkouts = workouts.length

  const totalVolume = useMemo(() => {
    return workouts.reduce((sum, workout) => sum + Number(workout.volume ?? 0), 0)
  }, [workouts])

  const loadHistory = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(workouts.length === 0)
        }

        setError(null)

        const response = await getMobileWorkoutHistory(getToken)
        setWorkouts(Array.isArray(response.workouts) ? response.workouts : [])
      } catch (err) {
        console.warn("Failed to load workout history", err)
        setError(
          err instanceof Error ? err.message : "Failed to load workout history"
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken, workouts.length]
  )

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openWorkout(workout: MobileWorkoutHistoryItem) {
    triggerLightHaptic()

    router.push({
      pathname: "/workout-history/[id]",
      params: {
        id: workout.id,
      },
    })
  }

  function goBackToWorkouts() {
    router.replace("/(tabs)/workouts")
  }

  if (loading && workouts.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHistory(true)}
            tintColor={colors.teal}
          />
        }
      >
        <View style={styles.topBar}>
          <Pressable onPress={goBackToWorkouts} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Workout History</Text>
            <Text style={styles.subtitle}>Review completed sessions.</Text>
          </View>
        </View>

        {error ? (
          <FitCard>
            <Text selectable style={styles.inlineError}>
              {error}
            </Text>

            <Pressable
              onPress={() => loadHistory()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </FitCard>
        ) : null}

        <FitCard accent>
          <Text style={styles.heroLabel}>Completed workouts</Text>
          <Text style={styles.heroTitle}>{totalWorkouts}</Text>
          <Text style={styles.heroText}>
            {totalWorkouts > 0
              ? `${formatVolume(totalVolume)} total strength volume logged.`
              : "Finished workouts will appear here."}
          </Text>
        </FitCard>

        {workouts.length > 0 ? (
          <View style={styles.list}>
            {workouts.map((workout) => (
              <WorkoutHistoryCard
                key={workout.id}
                workout={workout}
                onPress={() => openWorkout(workout)}
              />
            ))}
          </View>
        ) : (
          <FitCard>
            <Text style={styles.emptyTitle}>No completed workouts yet</Text>
            <Text style={styles.emptyText}>
              Finish a workout and it will show up here.
            </Text>
          </FitCard>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function WorkoutHistoryCard({
  workout,
  onPress,
}: {
  workout: MobileWorkoutHistoryItem
  onPress: () => void
}) {
  return (
    <FitCard style={styles.workoutCard} onPress={onPress}>
      <View style={styles.workoutRow}>
        <View style={styles.workoutMain}>
          <Text style={styles.workoutName}>{workout.name || "Workout"}</Text>
          <Text style={styles.workoutDate}>
            {formatDate(workout.performed_at)}
            {formatTime(workout.performed_at)
              ? ` · ${formatTime(workout.performed_at)}`
              : ""}
          </Text>

          <View style={styles.statsRow}>
            <StatPill
              label="Exercises"
              value={String(workout.exercise_count ?? 0)}
            />
            <StatPill label="Sets" value={String(workout.set_count ?? 0)} />
            <StatPill
              label="Duration"
              value={formatDuration(workout.duration_minutes)}
            />
          </View>
        </View>

        <View style={styles.volumeBlock}>
          <Text style={styles.volumeValue}>{formatVolume(workout.volume)}</Text>
          <Text style={styles.volumeLabel}>Volume</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textMuted}
            style={styles.chevron}
          />
        </View>
      </View>
    </FitCard>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    paddingBottom: 130,
    gap: spacing.md,
  },
  topBar: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backButton: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitleBlock: {
    flex: 1,
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
  heroLabel: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 4,
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  list: {
    gap: spacing.md,
  },
  workoutCard: {
    padding: spacing.md,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  workoutMain: {
    flex: 1,
  },
  workoutName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  workoutDate: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: spacing.md,
  },
  statPill: {
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 1,
    textTransform: "uppercase",
  },
  volumeBlock: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 78,
  },
  volumeValue: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: "900",
  },
  volumeLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase",
  },
  chevron: {
    marginTop: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
    marginTop: spacing.sm,
  },
})