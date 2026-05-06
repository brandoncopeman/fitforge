import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import StatTile from "@/components/StatTile"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"
import {
  getMobileProfile,
  getMobileStepLogs,
  saveMobileStepLog,
  updateMobileStepGoal,
} from "@/lib/api"
import { MobileStepLog } from "@/types/steps"

type SavingStatus = "idle" | "saving" | "saved" | "error"

function triggerLightHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

function shiftDate(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return getLocalDateString(date)
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeIntegerInput(value: string) {
  return value.replace(/[^0-9]/g, "")
}

function formatNumber(value: unknown) {
  return Math.round(toNumber(value, 0)).toLocaleString()
}

function formatDateTitle(dateString: string) {
  const today = getLocalDateString()
  const yesterday = shiftDate(today, -1)
  const tomorrow = shiftDate(today, 1)

  if (dateString === today) return "Today"
  if (dateString === yesterday) return "Yesterday"
  if (dateString === tomorrow) return "Tomorrow"

  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateString

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })
}

function formatHistoryDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateString

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function getMonthGrid(selectedMonth: Date) {
  const year = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay.getDay()

  const cells: ({ key: string; day: number; dateString: string } | null)[] = []

  for (let i = 0; i < startOffset; i += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    cells.push({
      key: getLocalDateString(date),
      day,
      dateString: getLocalDateString(date),
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

function getStepIntensity(steps: number, target: number) {
  if (steps <= 0 || target <= 0) return "none"
  if (steps >= target) return "full"
  if (steps >= target * 0.75) return "high"
  if (steps >= target * 0.5) return "medium"
  return "low"
}

export default function StepsScreen() {
  const { getToken } = useAuth()

  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [selectedMonth, setSelectedMonth] = useState(() => new Date())
  const [stepLogs, setStepLogs] = useState<MobileStepLog[]>([])
  const [dailyStepTarget, setDailyStepTarget] = useState(8000)
  const [stepInput, setStepInput] = useState("0")
  const [goalInput, setGoalInput] = useState("8000")

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingStatus, setSavingStatus] = useState<SavingStatus>("idle")
  const [goalSavingStatus, setGoalSavingStatus] =
    useState<SavingStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const stepSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goalSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestLogsRef = useRef<MobileStepLog[]>([])

  useEffect(() => {
    latestLogsRef.current = stepLogs
  }, [stepLogs])

  const stepsByDate = useMemo(() => {
    return stepLogs.reduce<Record<string, MobileStepLog>>((map, log) => {
      map[log.log_date] = log
      return map
    }, {})
  }, [stepLogs])

  const selectedLog = stepsByDate[selectedDate] ?? null
  const selectedSteps = toNumber(selectedLog?.steps ?? stepInput, 0)
  const todayLog = stepsByDate[getLocalDateString()] ?? null
  const todaySteps =
    selectedDate === getLocalDateString()
      ? selectedSteps
      : toNumber(todayLog?.steps, 0)

  const progress =
    dailyStepTarget > 0 ? Math.min(1, selectedSteps / dailyStepTarget) : 0

  const remainingSteps = Math.max(0, dailyStepTarget - selectedSteps)

  const averageSteps = useMemo(() => {
    if (stepLogs.length === 0) return 0

    const total = stepLogs.reduce((sum, log) => sum + toNumber(log.steps), 0)
    return Math.round(total / stepLogs.length)
  }, [stepLogs])

  const goalMetCount = useMemo(() => {
    return stepLogs.filter((log) => toNumber(log.steps) >= dailyStepTarget)
      .length
  }, [dailyStepTarget, stepLogs])

  const recentLogs = useMemo(() => {
    return [...stepLogs]
      .sort((a, b) => b.log_date.localeCompare(a.log_date))
      .slice(0, 14)
  }, [stepLogs])

  const monthCells = useMemo(() => {
    return getMonthGrid(selectedMonth)
  }, [selectedMonth])

  const loadSteps = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(stepLogs.length === 0)
        }

        setError(null)

        const [profileResponse, logs] = await Promise.all([
          getMobileProfile(getToken),
          getMobileStepLogs(getToken),
        ])

        const nextTarget = Math.max(
          1,
          toNumber(profileResponse.profile?.daily_step_target, 8000)
        )

        const nextLogs = Array.isArray(logs) ? logs : []
        const selected = nextLogs.find((log) => log.log_date === selectedDate)

        setDailyStepTarget(nextTarget)
        setGoalInput(String(nextTarget))
        setStepLogs(nextLogs)
        setStepInput(String(toNumber(selected?.steps, 0)))
      } catch (err) {
        console.warn("Failed to load steps", err)
        setError(err instanceof Error ? err.message : "Failed to load steps")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken, selectedDate, stepLogs.length]
  )

  useEffect(() => {
    loadSteps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const selected = stepsByDate[selectedDate]
    setStepInput(String(toNumber(selected?.steps, 0)))
  }, [selectedDate, stepsByDate])

  useEffect(() => {
    return () => {
      if (stepSaveTimerRef.current) {
        clearTimeout(stepSaveTimerRef.current)
      }

      if (goalSaveTimerRef.current) {
        clearTimeout(goalSaveTimerRef.current)
      }
    }
  }, [])

  function changeDate(days: number) {
    triggerLightHaptic()
    setSelectedDate((current) => shiftDate(current, days))
  }

  function changeMonth(direction: -1 | 1) {
    triggerLightHaptic()

    setSelectedMonth((current) => {
      const next = new Date(current)
      next.setMonth(next.getMonth() + direction)
      return next
    })
  }

  function upsertLocalStepLog(date: string, steps: number) {
    setStepLogs((current) => {
      const exists = current.some((log) => log.log_date === date)

      if (exists) {
        return current.map((log) =>
          log.log_date === date
            ? {
                ...log,
                steps,
              }
            : log
        )
      }

      return [
        {
          id: `temp-step-${date}`,
          steps,
          log_date: date,
          isTemp: true,
        },
        ...current,
      ]
    })
  }

  function updateStepInput(value: string) {
    const cleaned = normalizeIntegerInput(value)
    const steps = Math.max(0, toNumber(cleaned, 0))

    setStepInput(cleaned)
    upsertLocalStepLog(selectedDate, steps)
    setSavingStatus("saving")

    if (stepSaveTimerRef.current) {
      clearTimeout(stepSaveTimerRef.current)
    }

    stepSaveTimerRef.current = setTimeout(() => {
      stepSaveTimerRef.current = null

      saveMobileStepLog(getToken, {
        steps,
        log_date: selectedDate,
      })
        .then((savedLog) => {
          setStepLogs((current) =>
            current.map((log) =>
              log.log_date === selectedDate ? savedLog : log
            )
          )
          setSavingStatus("saved")
        })
        .catch((err: unknown) => {
          console.warn("Failed to save steps", err)
          setSavingStatus("error")
          setError(err instanceof Error ? err.message : "Failed to save steps")
        })
    }, 800)
  }

  function updateGoalInput(value: string) {
    const cleaned = normalizeIntegerInput(value)
    const nextGoal = Math.max(1, toNumber(cleaned, 1))

    setGoalInput(cleaned)
    setDailyStepTarget(nextGoal)
    setGoalSavingStatus("saving")

    if (goalSaveTimerRef.current) {
      clearTimeout(goalSaveTimerRef.current)
    }

    goalSaveTimerRef.current = setTimeout(() => {
      goalSaveTimerRef.current = null

      updateMobileStepGoal(getToken, nextGoal)
        .then((response) => {
          setDailyStepTarget(response.daily_step_target)
          setGoalInput(String(response.daily_step_target))
          setGoalSavingStatus("saved")
        })
        .catch((err: unknown) => {
          console.warn("Failed to save step goal", err)
          setGoalSavingStatus("error")
          setError(
            err instanceof Error ? err.message : "Failed to save step goal"
          )
        })
    }, 800)
  }

  function selectCalendarDate(dateString: string) {
    triggerLightHaptic()
    setSelectedDate(dateString)
  }

  if (loading && stepLogs.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading steps...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSteps(true)}
              tintColor={colors.teal}
            />
          }
        >
          <View>
            <Text style={styles.title}>Steps</Text>
            <Text style={styles.subtitle}>Daily movement and consistency</Text>
          </View>

          <FitCard style={styles.dateCard}>
            <Pressable
              onPress={() => changeDate(-1)}
              style={styles.dateButton}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>

            <View style={styles.dateCenter}>
              <Text style={styles.dateTitle}>
                {formatDateTitle(selectedDate)}
              </Text>
              <Text style={styles.dateSubtitle}>{selectedDate}</Text>
            </View>

            <Pressable onPress={() => changeDate(1)} style={styles.dateButton}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </FitCard>

          {error ? (
            <FitCard>
              <Text selectable style={styles.inlineError}>
                {error}
              </Text>
            </FitCard>
          ) : null}

          <FitCard accent>
            <Text style={styles.heroLabel}>Step count</Text>

            <TextInput
              value={stepInput}
              onChangeText={updateStepInput}
              keyboardType="numeric"
              selectTextOnFocus
              style={styles.stepInput}
            />

            <Text style={styles.heroSubtext}>
              / {formatNumber(dailyStepTarget)} step goal
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.heroFooter}>
              <Text style={styles.heroFooterText}>
                {remainingSteps > 0
                  ? `${formatNumber(remainingSteps)} steps remaining`
                  : "Goal reached"}
              </Text>

              <Text style={styles.saveStatusText}>
                {savingStatus === "saving"
                  ? "Saving..."
                  : savingStatus === "saved"
                  ? "Saved"
                  : savingStatus === "error"
                  ? "Save failed"
                  : "Ready"}
              </Text>
            </View>
          </FitCard>

          <View style={styles.tileRow}>
            <StatTile
              label="Today"
              value={formatNumber(todaySteps)}
              detail="steps"
              accent
            />
            <StatTile
              label="Average"
              value={formatNumber(averageSteps)}
              detail="logged days"
            />
          </View>

          <View style={styles.tileRow}>
            <StatTile
              label="Goal Days"
              value={goalMetCount}
              detail="all time"
            />
            <StatTile
              label="Progress"
              value={`${Math.round(progress * 100)}%`}
              detail="selected day"
              accent
            />
          </View>

          <FitCard>
            <Text style={styles.cardTitle}>Daily Step Goal</Text>
            <Text style={styles.cardText}>
              Changing this updates your target everywhere steps are shown.
            </Text>

            <View style={styles.goalInputRow}>
              <TextInput
                value={goalInput}
                onChangeText={updateGoalInput}
                keyboardType="numeric"
                selectTextOnFocus
                style={styles.goalInput}
              />
              <Text style={styles.goalSuffix}>steps</Text>
            </View>

            <Text style={styles.goalSaveText}>
              {goalSavingStatus === "saving"
                ? "Saving goal..."
                : goalSavingStatus === "saved"
                ? "Goal saved"
                : goalSavingStatus === "error"
                ? "Goal save failed"
                : "Goal ready"}
            </Text>
          </FitCard>

          <FitCard>
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={() => changeMonth(-1)}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>

              <Text style={styles.cardTitle}>{formatMonthTitle(selectedMonth)}</Text>

              <Pressable
                onPress={() => changeMonth(1)}
                style={styles.monthButton}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekDay}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {monthCells.map((cell, index) => {
                if (!cell) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />
                }

                const log = stepsByDate[cell.dateString]
                const steps = toNumber(log?.steps, 0)
                const intensity = getStepIntensity(steps, dailyStepTarget)
                const selected = cell.dateString === selectedDate

                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => selectCalendarDate(cell.dateString)}
                    style={[
                      styles.dayCell,
                      styles[`dayCell_${intensity}`],
                      selected ? styles.dayCellSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        selected ? styles.dayNumberSelected : null,
                      ]}
                    >
                      {cell.day}
                    </Text>

                    {steps > 0 ? (
                      <Text
                        style={[
                          styles.daySteps,
                          selected ? styles.dayNumberSelected : null,
                        ]}
                      >
                        {Math.round(steps / 1000)}k
                      </Text>
                    ) : null}
                  </Pressable>
                )
              })}
            </View>
          </FitCard>

          <FitCard>
            <Text style={styles.cardTitle}>Recent Step Logs</Text>

            {recentLogs.length > 0 ? (
              <View style={styles.historyList}>
                {recentLogs.map((log) => {
                  const steps = toNumber(log.steps, 0)
                  const goalMet = steps >= dailyStepTarget

                  return (
                    <Pressable
                      key={log.id}
                      onPress={() => selectCalendarDate(log.log_date)}
                      style={styles.historyRow}
                    >
                      <View>
                        <Text style={styles.historyDate}>
                          {formatHistoryDate(log.log_date)}
                        </Text>
                        <Text style={styles.historyMeta}>{log.log_date}</Text>
                      </View>

                      <View style={styles.historyRight}>
                        <Text style={styles.historySteps}>
                          {formatNumber(steps)}
                        </Text>
                        {goalMet ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={colors.teal}
                          />
                        ) : (
                          <Ionicons
                            name="ellipse-outline"
                            size={18}
                            color={colors.textMuted}
                          />
                        )}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Log your steps to start building history.
              </Text>
            )}
          </FitCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
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
  dateCard: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dateButton: {
    height: 42,
    width: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
  },
  dateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  dateSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  inlineError: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
  },
  heroLabel: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  stepInput: {
    color: colors.text,
    fontSize: 54,
    fontWeight: "900",
    padding: 0,
    marginTop: spacing.sm,
  },
  heroSubtext: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.teal,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    gap: spacing.md,
  },
  heroFooterText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "800",
  },
  saveStatusText: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
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
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  goalInputRow: {
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  goalInput: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    padding: 0,
  },
  goalSuffix: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  goalSaveText: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  weekHeader: {
    flexDirection: "row",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dayCell: {
    width: `${100 / 7 - 1}%`,
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCell_none: {
    backgroundColor: colors.surfaceLight,
  },
  dayCell_low: {
    backgroundColor: "rgba(20, 184, 166, 0.14)",
  },
  dayCell_medium: {
    backgroundColor: "rgba(20, 184, 166, 0.28)",
  },
  dayCell_high: {
    backgroundColor: "rgba(20, 184, 166, 0.44)",
  },
  dayCell_full: {
    backgroundColor: colors.teal,
  },
  dayCellSelected: {
    borderColor: colors.text,
    borderWidth: 2,
  },
  dayNumber: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  dayNumberSelected: {
    color: colors.text,
  },
  daySteps: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
  },
  historyList: {
    gap: spacing.sm,
  },
  historyRow: {
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  historyDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  historyMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  historyRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  historySteps: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: spacing.md,
  },
})