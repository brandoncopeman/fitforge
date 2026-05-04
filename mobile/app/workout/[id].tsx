import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { router, useLocalSearchParams } from "expo-router"
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
import {
  getCachedActiveWorkout,
  subscribeToCachedActiveWorkout,
} from "@/lib/activeWorkoutCache"
import { getMobileWorkout } from "@/lib/api"
import {
  MobileActiveWorkoutResponse,
  MobileExerciseSet,
} from "@/types/activeWorkout"

function triggerSetHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  }
}

function formatWeight(value: number | string) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return "0kg"
  return `${numberValue}kg`
}

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()

  const [data, setData] = useState<MobileActiveWorkoutResponse | null>(() => {
    if (!id) return null
    return getCachedActiveWorkout(id)
  })

  const [completedSetIds, setCompletedSetIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(!data)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadWorkout = useCallback(
    async (isRefresh = false) => {
      if (!id) return

      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError(null)

        const workout = await getMobileWorkout(getToken, id)
        setData(workout)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workout")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken, id]
  )

  useEffect(() => {
    if (!id) return
  
    if (id.startsWith("draft-workout")) {
      setLoading(false)
      return
    }
  
    loadWorkout(false)
  }, [id, loadWorkout])

  useEffect(() => {
    if (!id) return
  
    return subscribeToCachedActiveWorkout(id, (workout) => {
      setData(workout)
      setLoading(false)
      setError(null)
    })
  }, [id])

  const totalSets = useMemo(() => {
    return data?.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0
    ) ?? 0
  }, [data])

  const completedCount = completedSetIds.size

  function toggleSet(set: MobileExerciseSet) {
    triggerSetHaptic()

    setCompletedSetIds((current) => {
      const next = new Set(current)

      if (next.has(set.id)) {
        next.delete(set.id)
      } else {
        next.add(set.id)
      }

      return next
    })
  }

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </SafeAreaView>
    )
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <Text style={styles.errorTitle}>Couldn’t load workout</Text>
        <Text selectable style={styles.errorText}>
          {error}
        </Text>

        <FitCard accent onPress={() => loadWorkout()}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </FitCard>
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
            onRefresh={() => loadWorkout(true)}
            tintColor={colors.teal}
          />
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>{data?.workout.name ?? "Workout"}</Text>
            <Text style={styles.subtitle}>
              {completedCount}/{totalSets} sets complete
            </Text>
          </View>
        </View>

        {error ? (
          <FitCard>
            <Text selectable style={styles.inlineError}>
              {error}
            </Text>
          </FitCard>
        ) : null}

        <FitCard accent>
          <Text style={styles.eyebrow}>Active workout</Text>
          <Text style={styles.heroTitle}>{data?.workout.name}</Text>
          <Text style={styles.heroDetail}>
            Tap sets as you complete them. Full old-style workout controls come next.
          </Text>
        </FitCard>

        {data?.exercises.map((exercise) => (
          <FitCard key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View>
                <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                <Text style={styles.exerciseMeta}>
                  {exercise.muscle_group || "other"}
                </Text>
              </View>

              <Text style={styles.setCount}>{exercise.sets.length} sets</Text>
            </View>

            <View style={styles.setList}>
              {exercise.sets.map((set) => {
                const isComplete = completedSetIds.has(set.id)

                return (
                  <Pressable
                    key={set.id}
                    onPress={() => toggleSet(set)}
                    style={({ pressed }) => [
                      styles.setRow,
                      isComplete ? styles.setRowComplete : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.setNumber,
                        isComplete ? styles.setNumberComplete : null,
                      ]}
                    >
                      {isComplete ? (
                        <Ionicons
                          name="checkmark"
                          size={17}
                          color={colors.background}
                        />
                      ) : (
                        <Text style={styles.setNumberText}>{set.set_number}</Text>
                      )}
                    </View>

                    <View style={styles.setInfo}>
                      <Text style={styles.setPrimary}>
                        {set.reps} reps · {formatWeight(set.weight_kg)}
                      </Text>
                      <Text style={styles.setSecondary}>Set {set.set_number}</Text>
                    </View>

                    <Ionicons
                      name={isComplete ? "checkmark-circle" : "ellipse-outline"}
                      size={23}
                      color={isComplete ? colors.teal : colors.textMuted}
                    />
                  </Pressable>
                )
              })}
            </View>
          </FitCard>
        ))}

        <Pressable
          onPress={() => {
            triggerSetHaptic()
          }}
          style={({ pressed }) => [
            styles.finishButton,
            pressed ? styles.finishButtonPressed : null,
          ]}
        >
          <Text style={styles.finishButtonText}>Finish Workout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
  content: {
    padding: spacing.lg,
    paddingBottom: 130,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  inlineError: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  retryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  header: {
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
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
    textTransform: "capitalize",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    textTransform: "capitalize",
    marginTop: 4,
  },
  heroDetail: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  exerciseCard: {
    padding: spacing.md,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  exerciseMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
    textTransform: "capitalize",
  },
  setCount: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
  },
  setList: {
    gap: spacing.sm,
  },
  setRow: {
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  setRowComplete: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
  },
  setNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  setNumberComplete: {
    backgroundColor: colors.teal,
  },
  setNumberText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
  },
  setInfo: {
    flex: 1,
  },
  setPrimary: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  setSecondary: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  finishButton: {
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  finishButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  finishButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
})