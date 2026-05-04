import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import { router } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
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
import { setCachedActiveWorkout } from "@/lib/activeWorkoutCache"
import { getMobileHome, startMobileWorkout } from "@/lib/api"
import { MobileHomeResponse } from "@/types/home"

function getFirstName(name?: string | null) {
  if (!name) return "there"
  return name.split(" ")[0]
}

export default function HomeScreen() {
  const { getToken } = useAuth()

  const [data, setData] = useState<MobileHomeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [startingWorkout, setStartingWorkout] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHome = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError(null)

        const home = await getMobileHome(getToken)
        setData(home)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load home")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken]
  )

  useEffect(() => {
    loadHome()
  }, [loadHome])

  async function handleStartNextWorkout() {
    if (startingWorkout) return

    try {
      setStartingWorkout(true)
      setError(null)

      const activeWorkout = await startMobileWorkout(getToken)
      setCachedActiveWorkout(activeWorkout)

      router.push({
        pathname: "/workout/[id]",
        params: {
          id: activeWorkout.workout.id,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start workout")
    } finally {
      setStartingWorkout(false)
    }
  }

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading FitForge...</Text>
      </SafeAreaView>
    )
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <Text style={styles.errorTitle}>Couldn’t load Home</Text>
        <Text selectable style={styles.errorText}>
          {error}
        </Text>

        <FitCard accent onPress={() => loadHome()}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </FitCard>
      </SafeAreaView>
    )
  }

  const profile = data?.profile
  const dashboard = data?.dashboard
  const plan = data?.plan
  const progress = data?.progress

  const latestProgress = progress?.events?.[0] ?? null
  const weeklyRecap = progress?.weeklyRecap ?? null
  const nextTemplate = plan?.nextTemplate ?? null
  const planStatus = plan?.status ?? null

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHome(true)}
            tintColor={colors.teal}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>FitForge</Text>
            <Text style={styles.subTitle}>Native preview</Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.display_name || "B")[0]?.toUpperCase()}
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

        <FitCard>
          <Text style={styles.welcome}>
            Welcome back, {getFirstName(profile?.display_name)}
          </Text>
          <Text style={styles.quote}>“{profile?.daily_quote.text}”</Text>
          <Text style={styles.quoteAuthor}>— {profile?.daily_quote.author}</Text>
        </FitCard>

        <FitCard accent onPress={handleStartNextWorkout}>
          <View style={styles.nextHeader}>
            <View style={styles.nextTextBlock}>
              <Text style={styles.eyebrow}>
                {nextTemplate ? "Next in plan" : "No plan set"}
              </Text>
              <Text style={styles.nextTitle}>
                {nextTemplate?.name ?? "Empty Workout"}
              </Text>
              <Text style={styles.nextDetail}>
                {nextTemplate
                  ? `${nextTemplate.exercise_count ?? 0} exercises`
                  : "Create a workout plan first"}
              </Text>
            </View>

            <View style={styles.startCircle}>
              {startingWorkout ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Ionicons name="play" size={24} color={colors.background} />
              )}
            </View>
          </View>
        </FitCard>

        <View style={styles.tileRow}>
          <StatTile
            label="Calories"
            value={dashboard?.caloriesConsumed ?? 0}
            detail={`of ${profile?.daily_calorie_target ?? 0} kcal`}
            accent
          />
          <StatTile
            label="Steps"
            value={(dashboard?.todaySteps ?? 0).toLocaleString()}
            detail={`of ${(profile?.daily_step_target ?? 8000).toLocaleString()}`}
          />
        </View>

        <View style={styles.tileRow}>
          <StatTile
            label="Weight"
            value={dashboard?.latestWeight ? `${dashboard.latestWeight}kg` : "—"}
            detail="latest log"
          />
          <StatTile
            label="Streak"
            value={`${planStatus?.streakWeeks ?? 0}w`}
            detail="workout streak"
            accent
          />
        </View>

        {planStatus ? (
          <FitCard onPress={() => router.push("/workouts")}>
            <View style={styles.rowBetween}>
              <View style={styles.rowIconText}>
                <View style={styles.iconBadge}>
                  <Text style={styles.statusEmoji}>{planStatus.emoji}</Text>
                </View>

                <View style={styles.flexOne}>
                  <Text style={styles.cardTitle}>{planStatus.title}</Text>
                  <Text style={styles.cardDetail}>{planStatus.message}</Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </FitCard>
        ) : null}

        {latestProgress ? (
          <FitCard onPress={() => router.push("/stats")}>
            <Text style={styles.cardEyebrow}>Progress Story</Text>
            <Text style={styles.cardTitle}>
              {latestProgress.emoji ?? "✨"} {latestProgress.title}
            </Text>
            <Text style={styles.cardDetail}>{latestProgress.message}</Text>
          </FitCard>
        ) : null}

        {weeklyRecap ? (
          <FitCard onPress={() => router.push("/stats")}>
            <Text style={styles.cardEyebrow}>Weekly Recap</Text>
            <Text style={styles.cardTitle}>
              {weeklyRecap.emoji ?? "📅"} {weeklyRecap.title}
            </Text>

            <View style={styles.recapGrid}>
              <View style={styles.recapTile}>
                <Text style={styles.recapValue}>{weeklyRecap.workouts}</Text>
                <Text style={styles.recapLabel}>workouts</Text>
              </View>

              <View style={styles.recapTile}>
                <Text style={styles.recapValue}>
                  {weeklyRecap.averageDailyCalories.toLocaleString()}
                </Text>
                <Text style={styles.recapLabel}>avg kcal</Text>
              </View>

              <View style={styles.recapTile}>
                <Text style={styles.recapValue}>
                  {weeklyRecap.steps.toLocaleString()}
                </Text>
                <Text style={styles.recapLabel}>steps</Text>
              </View>

              <View style={styles.recapTile}>
                <Text style={styles.recapValue}>{weeklyRecap.goals}</Text>
                <Text style={styles.recapLabel}>goals</Text>
              </View>
            </View>
          </FitCard>
        ) : null}

        <View style={styles.quickGrid}>
          <FitCard style={styles.quickCard} onPress={() => router.push("/workouts")}>
            <Text style={styles.quickEmoji}>🏋️</Text>
            <Text style={styles.quickTitle}>Workouts</Text>
            <Text style={styles.quickDetail}>Templates & history</Text>
          </FitCard>

          <FitCard style={styles.quickCard} onPress={() => router.push("/stats")}>
            <Text style={styles.quickEmoji}>📈</Text>
            <Text style={styles.quickTitle}>Stats</Text>
            <Text style={styles.quickDetail}>Progress & badges</Text>
          </FitCard>

          <FitCard style={styles.quickCard}>
            <Text style={styles.quickEmoji}>🥗</Text>
            <Text style={styles.quickTitle}>Food</Text>
            <Text style={styles.quickDetail}>Coming soon</Text>
          </FitCard>

          <FitCard style={styles.quickCard}>
            <Text style={styles.quickEmoji}>🎯</Text>
            <Text style={styles.quickTitle}>Goals</Text>
            <Text style={styles.quickDetail}>Coming soon</Text>
          </FitCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 130,
    gap: spacing.md,
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
    justifyContent: "space-between",
  },
  appTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  avatar: {
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: colors.tealDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
  welcome: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  quote: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: "italic",
  },
  quoteAuthor: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  nextHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextTextBlock: {
    flex: 1,
    paddingRight: spacing.md,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  nextTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    textTransform: "capitalize",
    marginTop: 4,
  },
  nextDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  startCircle: {
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  tileRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowIconText: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusEmoji: {
    fontSize: 20,
  },
  cardEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  cardDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 18,
  },
  recapGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  recapTile: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  recapValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  recapLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  quickCard: {
    width: "47.9%",
    minHeight: 132,
  },
  quickEmoji: {
    fontSize: 25,
    marginBottom: spacing.sm,
  },
  quickTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  quickDetail: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 17,
  },
})