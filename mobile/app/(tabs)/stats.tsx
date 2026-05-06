import { useAuth } from "@clerk/clerk-expo"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import StatTile from "@/components/StatTile"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"
import { getMobileStats } from "@/lib/api"
import {
  MobileStatsExercise,
  MobileStatsResponse,
  MobileStatsWorkout,
} from "@/types/stats"

type StatsTab = "volume" | "strength" | "muscles"
type PeriodFilter = "30" | "90" | "all"

type VolumePoint = {
  id: string
  label: string
  date: string
  volume: number
}

type OneRepMaxPoint = {
  workoutId: string
  date: string
  label: string
  exerciseName: string
  estimatedOneRepMax: number
  weight: number
  reps: number
}

type MusclePoint = {
  muscle: string
  count: number
}

function getNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function calculateExerciseVolume(exercise: MobileStatsExercise) {
  return exercise.sets.reduce((sum, set) => {
    return sum + getNumber(set.weight_kg) * getNumber(set.reps)
  }, 0)
}

function calculateWorkoutVolume(workout: MobileStatsWorkout) {
  return workout.exercises.reduce((sum, exercise) => {
    return sum + calculateExerciseVolume(exercise)
  }, 0)
}

function calculateWorkoutSets(workout: MobileStatsWorkout) {
  return workout.exercises.reduce((sum, exercise) => {
    return sum + exercise.sets.length
  }, 0)
}

function estimateOneRepMax(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0
  return weight * (1 + reps / 30)
}

function formatDateLabel(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0"

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}m`
  }

  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}k`
  }

  return `${Math.round(value)}`
}

function formatKg(value: number) {
  return `${Math.round(value).toLocaleString()}kg`
}

function filterWorkoutsByPeriod(
  workouts: MobileStatsWorkout[],
  period: PeriodFilter
) {
  if (period === "all") return workouts

  const days = Number(period)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  return workouts.filter((workout) => {
    const date = new Date(workout.created_at)
    return !Number.isNaN(date.getTime()) && date >= cutoff
  })
}

function buildVolumePoints(workouts: MobileStatsWorkout[]): VolumePoint[] {
  return workouts.map((workout) => ({
    id: workout.id,
    label: formatDateLabel(workout.created_at),
    date: workout.created_at,
    volume: calculateWorkoutVolume(workout),
  }))
}

function buildOneRepMaxPoints(
  workouts: MobileStatsWorkout[]
): Record<string, OneRepMaxPoint[]> {
  const map: Record<string, OneRepMaxPoint[]> = {}

  workouts.forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      const exerciseName = exercise.exercise_name

      const bestSet = exercise.sets.reduce<{
        estimatedOneRepMax: number
        weight: number
        reps: number
      } | null>((best, set) => {
        const weight = getNumber(set.weight_kg)
        const reps = getNumber(set.reps)
        const estimated = estimateOneRepMax(weight, reps)

        if (estimated <= 0) {
          return best
        }

        if (!best || estimated > best.estimatedOneRepMax) {
          return {
            estimatedOneRepMax: estimated,
            weight,
            reps,
          }
        }

        return best
      }, null)

      if (!bestSet) {
        return
      }

      if (!map[exerciseName]) {
        map[exerciseName] = []
      }

      map[exerciseName].push({
        workoutId: workout.id,
        date: workout.created_at,
        label: formatDateLabel(workout.created_at),
        exerciseName,
        estimatedOneRepMax: bestSet.estimatedOneRepMax,
        weight: bestSet.weight,
        reps: bestSet.reps,
      })
    })
  })

  return map
}

function buildMusclePoints(workouts: MobileStatsWorkout[]): MusclePoint[] {
  const map: Record<string, number> = {}

  workouts.forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      const muscle = exercise.muscle_group?.trim() || "other"
      const normalized = muscle.toLowerCase()

      map[normalized] = (map[normalized] ?? 0) + 1
    })
  })

  return Object.entries(map)
    .map(([muscle, count]) => ({
      muscle,
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

function getBestOneRepMax(
  oneRepMaxByExercise: Record<string, OneRepMaxPoint[]>
) {
  let best: OneRepMaxPoint | null = null

  Object.values(oneRepMaxByExercise).forEach((points) => {
    points.forEach((point) => {
      if (!best || point.estimatedOneRepMax > best.estimatedOneRepMax) {
        best = point
      }
    })
  })

  return best
}

export default function StatsScreen() {
  const { getToken } = useAuth()

  const [data, setData] = useState<MobileStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<StatsTab>("volume")
  const [period, setPeriod] = useState<PeriodFilter>("90")
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)

  const workouts = useMemo(() => {
    return Array.isArray(data?.workouts) ? data.workouts : []
  }, [data?.workouts])

  const filteredWorkouts = useMemo(() => {
    return filterWorkoutsByPeriod(workouts, period)
  }, [period, workouts])

  const volumePoints = useMemo(() => {
    return buildVolumePoints(filteredWorkouts).slice(-8)
  }, [filteredWorkouts])

  const oneRepMaxByExercise = useMemo(() => {
    return buildOneRepMaxPoints(filteredWorkouts)
  }, [filteredWorkouts])

  const exerciseNames = useMemo(() => {
    return Object.keys(oneRepMaxByExercise).sort((a, b) => a.localeCompare(b))
  }, [oneRepMaxByExercise])

  const selectedOneRepMaxPoints = useMemo(() => {
    if (!selectedExercise) return []
    return oneRepMaxByExercise[selectedExercise] ?? []
  }, [oneRepMaxByExercise, selectedExercise])

  const musclePoints = useMemo(() => {
    return buildMusclePoints(filteredWorkouts)
  }, [filteredWorkouts])

  const totalWorkouts = filteredWorkouts.length

  const totalSets = useMemo(() => {
    return filteredWorkouts.reduce((sum, workout) => {
      return sum + calculateWorkoutSets(workout)
    }, 0)
  }, [filteredWorkouts])

  const totalVolume = useMemo(() => {
    return filteredWorkouts.reduce((sum, workout) => {
      return sum + calculateWorkoutVolume(workout)
    }, 0)
  }, [filteredWorkouts])

  const totalMinutes = useMemo(() => {
    return filteredWorkouts.reduce((sum, workout) => {
      return sum + getNumber(workout.duration_minutes)
    }, 0)
  }, [filteredWorkouts])

  const bestOneRepMax = useMemo(() => {
    return getBestOneRepMax(oneRepMaxByExercise)
  }, [oneRepMaxByExercise])

  useEffect(() => {
    if (!selectedExercise && exerciseNames.length > 0) {
      setSelectedExercise(exerciseNames[0])
    }

    if (
      selectedExercise &&
      exerciseNames.length > 0 &&
      !exerciseNames.includes(selectedExercise)
    ) {
      setSelectedExercise(exerciseNames[0])
    }
  }, [exerciseNames, selectedExercise])

  const loadStats = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(!data)
        }

        setError(null)

        const response = await getMobileStats(getToken)
        setData(response)
      } catch (err) {
        console.warn("Failed to load stats", err)
        setError(err instanceof Error ? err.message : "Failed to load stats")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [data, getToken]
  )

  useEffect(() => {
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading stats...</Text>
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
            onRefresh={() => loadStats(true)}
            tintColor={colors.teal}
          />
        }
      >
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Progress, strength, and balance</Text>

        <PeriodSwitcher period={period} onChange={setPeriod} />

        {error ? (
          <FitCard>
            <Text selectable style={styles.inlineError}>
              {error}
            </Text>

            <Pressable
              onPress={() => loadStats()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </FitCard>
        ) : null}

        <View style={styles.tileRow}>
          <StatTile
            label="Workouts"
            value={totalWorkouts}
            detail={period === "all" ? "all time" : `last ${period}d`}
            accent
          />
          <StatTile
            label="Volume"
            value={formatCompactNumber(totalVolume)}
            detail="kg lifted"
          />
        </View>

        <View style={styles.tileRow}>
          <StatTile label="Sets" value={totalSets} detail="logged" />
          <StatTile
            label="Minutes"
            value={totalMinutes}
            detail="trained"
            accent
          />
        </View>

        <FitCard accent>
          <Text style={styles.cardTitle}>Performance Summary</Text>
          <Text style={styles.cardText}>
            {totalWorkouts > 0
              ? `You logged ${totalWorkouts} workout${
                  totalWorkouts === 1 ? "" : "s"
                }, ${totalSets} set${
                  totalSets === 1 ? "" : "s"
                }, and ${formatKg(totalVolume)} of strength volume.`
              : "Complete workouts to start building your stats."}
          </Text>
        </FitCard>

        <View style={styles.tabRow}>
          <StatsTabButton
            label="Volume"
            active={activeTab === "volume"}
            onPress={() => setActiveTab("volume")}
          />
          <StatsTabButton
            label="1RM"
            active={activeTab === "strength"}
            onPress={() => setActiveTab("strength")}
          />
          <StatsTabButton
            label="Muscles"
            active={activeTab === "muscles"}
            onPress={() => setActiveTab("muscles")}
          />
        </View>

        {activeTab === "volume" ? (
          <VolumeSection points={volumePoints} />
        ) : null}

        {activeTab === "strength" ? (
          <OneRepMaxSection
            exerciseNames={exerciseNames}
            selectedExercise={selectedExercise}
            points={selectedOneRepMaxPoints}
            bestPoint={bestOneRepMax}
            onSelectExercise={setSelectedExercise}
          />
        ) : null}

        {activeTab === "muscles" ? (
          <MuscleSection points={musclePoints} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function PeriodSwitcher({
  period,
  onChange,
}: {
  period: PeriodFilter
  onChange: (period: PeriodFilter) => void
}) {
  return (
    <View style={styles.periodRow}>
      <PeriodButton
        label="30D"
        active={period === "30"}
        onPress={() => onChange("30")}
      />
      <PeriodButton
        label="90D"
        active={period === "90"}
        onPress={() => onChange("90")}
      />
      <PeriodButton
        label="All"
        active={period === "all"}
        onPress={() => onChange("all")}
      />
    </View>
  )
}

function PeriodButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.periodButton,
        active ? styles.periodButtonActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.periodButtonText,
          active ? styles.periodButtonTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function StatsTabButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        active ? styles.tabButtonActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function VolumeSection({ points }: { points: VolumePoint[] }) {
  const maxVolume = Math.max(...points.map((point) => point.volume), 1)

  return (
    <FitCard>
      <Text style={styles.cardTitle}>Volume Over Time</Text>
      <Text style={styles.cardText}>
        Total strength volume per workout: weight × reps summed across every
        set.
      </Text>

      {points.length > 0 ? (
        <View style={styles.barChart}>
          {points.map((point) => {
            const height = Math.max(10, (point.volume / maxVolume) * 110)

            return (
              <View key={point.id} style={styles.barColumn}>
                <Text style={styles.barValue}>
                  {formatCompactNumber(point.volume)}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height }]} />
                </View>
                <Text style={styles.barLabel}>{point.label}</Text>
              </View>
            )
          })}
        </View>
      ) : (
        <EmptyStatsText text="No volume data yet." />
      )}
    </FitCard>
  )
}

function OneRepMaxSection({
  exerciseNames,
  selectedExercise,
  points,
  bestPoint,
  onSelectExercise,
}: {
  exerciseNames: string[]
  selectedExercise: string | null
  points: OneRepMaxPoint[]
  bestPoint: OneRepMaxPoint | null
  onSelectExercise: (exercise: string) => void
}) {
  const maxOneRepMax = Math.max(
    ...points.map((point) => point.estimatedOneRepMax),
    1
  )

  return (
    <FitCard>
      <Text style={styles.cardTitle}>Estimated 1RM</Text>
      <Text style={styles.cardText}>
        Uses the Epley formula: weight × (1 + reps / 30).
      </Text>

      {bestPoint ? (
        <View style={styles.bestLiftBox}>
          <Text style={styles.bestLiftLabel}>Best lift estimate</Text>
          <Text style={styles.bestLiftValue}>
            {Math.round(bestPoint.estimatedOneRepMax)}kg
          </Text>
          <Text style={styles.bestLiftDetail}>
            {bestPoint.exerciseName} · {bestPoint.weight}kg × {bestPoint.reps}
          </Text>
        </View>
      ) : null}

      {exerciseNames.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exerciseSelector}
        >
          {exerciseNames.map((exerciseName) => (
            <Pressable
              key={exerciseName}
              onPress={() => onSelectExercise(exerciseName)}
              style={({ pressed }) => [
                styles.exerciseChip,
                selectedExercise === exerciseName
                  ? styles.exerciseChipActive
                  : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text
                style={[
                  styles.exerciseChipText,
                  selectedExercise === exerciseName
                    ? styles.exerciseChipTextActive
                    : null,
                ]}
              >
                {exerciseName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {points.length > 0 ? (
        <View style={styles.lineList}>
          {points.slice(-6).map((point) => {
            const percent = Math.max(
              0.05,
              point.estimatedOneRepMax / maxOneRepMax
            )

            return (
              <View key={`${point.workoutId}-${point.exerciseName}`}>
                <View style={styles.lineRowHeader}>
                  <Text style={styles.lineLabel}>{point.label}</Text>
                  <Text style={styles.lineValue}>
                    {Math.round(point.estimatedOneRepMax)}kg
                  </Text>
                </View>

                <View style={styles.horizontalTrack}>
                  <View
                    style={[
                      styles.horizontalFill,
                      {
                        width: `${Math.min(100, percent * 100)}%`,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.lineDetail}>
                  {point.weight}kg × {point.reps}
                </Text>
              </View>
            )
          })}
        </View>
      ) : (
        <EmptyStatsText text="No strength trend data yet." />
      )}
    </FitCard>
  )
}

function MuscleSection({ points }: { points: MusclePoint[] }) {
  const maxCount = Math.max(...points.map((point) => point.count), 1)
  const totalCount = points.reduce((sum, point) => sum + point.count, 0)

  return (
    <FitCard>
      <Text style={styles.cardTitle}>Muscle Group Distribution</Text>
      <Text style={styles.cardText}>
        Counts how often each muscle group appears across your workouts.
      </Text>

      {points.length > 0 ? (
        <View style={styles.muscleList}>
          {points.map((point) => {
            const percentOfMax = point.count / maxCount
            const percentOfTotal =
              totalCount > 0 ? Math.round((point.count / totalCount) * 100) : 0

            return (
              <View key={point.muscle} style={styles.muscleRow}>
                <View style={styles.muscleHeader}>
                  <Text style={styles.muscleName}>{point.muscle}</Text>
                  <Text style={styles.muscleCount}>
                    {point.count} · {percentOfTotal}%
                  </Text>
                </View>

                <View style={styles.horizontalTrack}>
                  <View
                    style={[
                      styles.horizontalFill,
                      {
                        width: `${Math.max(5, percentOfMax * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )
          })}
        </View>
      ) : (
        <EmptyStatsText text="No muscle group data yet." />
      )}
    </FitCard>
  )
}

function EmptyStatsText({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>
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
    marginBottom: spacing.sm,
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
  periodRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  periodButton: {
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  periodButtonActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  periodButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  periodButtonTextActive: {
    color: colors.background,
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
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
  },
  tabButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
  },
  tabButtonTextActive: {
    color: colors.teal,
  },
  barChart: {
    height: 176,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    marginTop: spacing.lg,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  barValue: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  barTrack: {
    width: "100%",
    maxWidth: 28,
    height: 112,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.teal,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  bestLiftBox: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  bestLiftLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  bestLiftValue: {
    color: colors.teal,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 2,
  },
  bestLiftDetail: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "capitalize",
  },
  exerciseSelector: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  exerciseChip: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  exerciseChipActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  exerciseChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  exerciseChipTextActive: {
    color: colors.background,
  },
  lineList: {
    gap: spacing.md,
  },
  lineRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lineLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  lineValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  horizontalTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    overflow: "hidden",
    marginTop: 6,
  },
  horizontalFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.teal,
  },
  lineDetail: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  muscleList: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  muscleRow: {
    gap: 6,
  },
  muscleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muscleName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  muscleCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing.lg,
  },
})