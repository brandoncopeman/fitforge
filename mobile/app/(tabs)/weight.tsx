import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { useCallback, useEffect, useMemo, useState } from "react"
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
  getMobileWeightLogs,
  saveMobileWeightLog,
} from "@/lib/api"
import { MobileWeightLog } from "@/types/weight"

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

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

function normalizeLogDate(value: unknown) {
  if (!value) return getLocalDateString()

  if (typeof value === "string") {
    return value.slice(0, 10)
  }

  if (value instanceof Date) {
    return getLocalDateString(value)
  }

  return String(value).slice(0, 10)
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function roundWeight(value: unknown) {
  return Math.round(toNumber(value, 0) * 10) / 10
}

function normalizeWeightLog(log: MobileWeightLog): MobileWeightLog {
  return {
    ...log,
    log_date: normalizeLogDate(log.log_date),
    weight_kg: roundWeight(log.weight_kg),
  }
}

function normalizeWeightLogs(logs: MobileWeightLog[]) {
  return logs.map(normalizeWeightLog)
}

function shiftDate(dateString: string, days: number) {
  const date = new Date(`${normalizeLogDate(dateString)}T12:00:00`)
  date.setDate(date.getDate() + days)
  return getLocalDateString(date)
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

function formatWeight(value: unknown) {
  const number = roundWeight(value)
  if (number <= 0) return "—"
  return `${number}kg`
}

function formatSignedWeight(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0kg"

  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? "+" : ""}${rounded}kg`
}

function formatDateTitle(dateString: string) {
  const normalizedDate = normalizeLogDate(dateString)
  const today = getLocalDateString()
  const yesterday = shiftDate(today, -1)
  const tomorrow = shiftDate(today, 1)

  if (normalizedDate === today) return "Today"
  if (normalizedDate === yesterday) return "Yesterday"
  if (normalizedDate === tomorrow) return "Tomorrow"

  const date = new Date(`${normalizedDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return normalizedDate

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
  const normalizedDate = normalizeLogDate(dateString)
  const today = getLocalDateString()
  const yesterday = shiftDate(today, -1)

  if (normalizedDate === today) return "Today"
  if (normalizedDate === yesterday) return "Yesterday"

  const date = new Date(`${normalizedDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return normalizedDate

  return date.toLocaleDateString(undefined, {
    weekday: "long",
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

function calculateWeeklyRate(logs: MobileWeightLog[]) {
  const sorted = [...logs]
    .map(normalizeWeightLog)
    .sort((a, b) =>
      normalizeLogDate(b.log_date).localeCompare(normalizeLogDate(a.log_date))
    )

  const today = new Date(`${getLocalDateString()}T12:00:00`)

  const recent = sorted.filter((log) => {
    const date = new Date(`${normalizeLogDate(log.log_date)}T12:00:00`)
    const daysAgo = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo >= 0 && daysAgo <= 30
  })

  if (recent.length < 2) return null

  const newest = recent[0]
  const oldest = recent[recent.length - 1]

  const newestDate = new Date(`${normalizeLogDate(newest.log_date)}T12:00:00`)
  const oldestDate = new Date(`${normalizeLogDate(oldest.log_date)}T12:00:00`)

  const daysBetween =
    (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)

  if (daysBetween <= 0) return null

  const weeksBetween = daysBetween / 7
  const totalChange = toNumber(newest.weight_kg) - toNumber(oldest.weight_kg)

  return totalChange / weeksBetween
}

function estimateGoalDate(
  currentWeight: number,
  goalWeight: number,
  weeklyRate: number | null
) {
  if (!weeklyRate || weeklyRate === 0) return null

  const remaining = goalWeight - currentWeight

  if (remaining === 0) return "Goal reached"
  if (Math.sign(remaining) !== Math.sign(weeklyRate)) return null

  const weeksToGoal = Math.abs(remaining / weeklyRate)

  if (!Number.isFinite(weeksToGoal) || weeksToGoal > 520) return null

  const estimated = new Date()
  estimated.setDate(estimated.getDate() + Math.round(weeksToGoal * 7))

  return estimated.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function WeightScreen() {
  const { getToken } = useAuth()

  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [selectedMonth, setSelectedMonth] = useState(() => new Date())
  const [weightLogs, setWeightLogs] = useState<MobileWeightLog[]>([])
  const [weightInput, setWeightInput] = useState("")
  const [goalWeight, setGoalWeight] = useState<number | null>(null)
  const [profileWeight, setProfileWeight] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingStatus, setSavingStatus] = useState<SavingStatus>("idle")
  const [hasWeightChanges, setHasWeightChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weightByDate = useMemo(() => {
    return weightLogs.reduce<Record<string, MobileWeightLog>>((map, log) => {
      const normalizedDate = normalizeLogDate(log.log_date)

      map[normalizedDate] = {
        ...log,
        log_date: normalizedDate,
      }

      return map
    }, {})
  }, [weightLogs])

  const selectedLog = weightByDate[normalizeLogDate(selectedDate)] ?? null
  const selectedWeight = roundWeight(weightInput || selectedLog?.weight_kg)

  const sortedLogs = useMemo(() => {
    return [...weightLogs]
      .map(normalizeWeightLog)
      .sort((a, b) =>
        normalizeLogDate(b.log_date).localeCompare(normalizeLogDate(a.log_date))
      )
  }, [weightLogs])

  const latestWeight = sortedLogs[0]
    ? roundWeight(sortedLogs[0].weight_kg)
    : roundWeight(profileWeight)

  const previousWeight = sortedLogs[1] ? roundWeight(sortedLogs[1].weight_kg) : 0

  const changeFromPrevious =
    latestWeight > 0 && previousWeight > 0
      ? Math.round((latestWeight - previousWeight) * 10) / 10
      : 0

  const weeklyRate = useMemo(() => calculateWeeklyRate(weightLogs), [weightLogs])

  const estimatedGoalDate =
    goalWeight && latestWeight
      ? estimateGoalDate(latestWeight, goalWeight, weeklyRate)
      : null

  const goalDifference =
    goalWeight && latestWeight
      ? Math.round((goalWeight - latestWeight) * 10) / 10
      : null

  const recentLogs = useMemo(() => {
    return sortedLogs.slice(0, 14)
  }, [sortedLogs])

  const monthCells = useMemo(() => {
    return getMonthGrid(selectedMonth)
  }, [selectedMonth])

  const loadWeight = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(weightLogs.length === 0)
        }

        setError(null)

        const [profileResponse, logs] = await Promise.all([
          getMobileProfile(getToken),
          getMobileWeightLogs(getToken),
        ])

        const nextLogs = normalizeWeightLogs(Array.isArray(logs) ? logs : [])
        const selected = nextLogs.find(
          (log) =>
            normalizeLogDate(log.log_date) === normalizeLogDate(selectedDate)
        )

        setWeightLogs(nextLogs)

        setGoalWeight(
          profileResponse.profile?.goal_weight_kg === null ||
            profileResponse.profile?.goal_weight_kg === undefined
            ? null
            : roundWeight(profileResponse.profile.goal_weight_kg)
        )

        setProfileWeight(
          profileResponse.profile?.weight_kg === null ||
            profileResponse.profile?.weight_kg === undefined
            ? null
            : roundWeight(profileResponse.profile.weight_kg)
        )

        setWeightInput(selected ? String(selected.weight_kg) : "")
        setHasWeightChanges(false)
        setSavingStatus("idle")
      } catch (err) {
        console.warn("Failed to load weight", err)
        setError(err instanceof Error ? err.message : "Failed to load weight")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken, selectedDate, weightLogs.length]
  )

  useEffect(() => {
    loadWeight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const selected = weightByDate[normalizeLogDate(selectedDate)]
    setWeightInput(selected ? String(selected.weight_kg) : "")
    setHasWeightChanges(false)
    setSavingStatus("idle")
  }, [selectedDate, weightByDate])

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

  function upsertLocalWeightLog(date: string, weightKg: number) {
    const normalizedDate = normalizeLogDate(date)

    setWeightLogs((current) => {
      const exists = current.some(
        (log) => normalizeLogDate(log.log_date) === normalizedDate
      )

      if (exists) {
        return current.map((log) =>
          normalizeLogDate(log.log_date) === normalizedDate
            ? {
                ...log,
                log_date: normalizedDate,
                weight_kg: weightKg,
              }
            : log
        )
      }

      return [
        {
          id: `temp-weight-${normalizedDate}`,
          weight_kg: weightKg,
          log_date: normalizedDate,
          isTemp: true,
        },
        ...current,
      ]
    })
  }

  function updateWeightInput(value: string) {
    const cleaned = normalizeDecimalInput(value)
    const weightKg = roundWeight(cleaned)

    setWeightInput(cleaned)

    if (weightKg > 0) {
      upsertLocalWeightLog(selectedDate, weightKg)
    }

    setHasWeightChanges(true)
    setSavingStatus("idle")
  }

  async function saveSelectedWeight() {
    const weightKg = roundWeight(weightInput)
    const normalizedSelectedDate = normalizeLogDate(selectedDate)

    if (weightKg <= 0) {
      setError("Enter a valid weight.")
      return
    }

    try {
      triggerMediumHaptic()
      setSavingStatus("saving")
      setError(null)

      const savedLog = await saveMobileWeightLog(getToken, {
        weight_kg: weightKg,
        log_date: normalizedSelectedDate,
      })

      const normalizedSavedLog = normalizeWeightLog(savedLog)

      setWeightLogs((current) => {
        const exists = current.some(
          (log) => normalizeLogDate(log.log_date) === normalizedSelectedDate
        )

        if (!exists) {
          return [normalizedSavedLog, ...current]
        }

        return current.map((log) =>
          normalizeLogDate(log.log_date) === normalizedSelectedDate
            ? normalizedSavedLog
            : log
        )
      })

      setWeightInput(String(normalizedSavedLog.weight_kg))
      setHasWeightChanges(false)
      setSavingStatus("saved")
    } catch (err) {
      console.warn("Failed to save weight", err)
      setSavingStatus("error")
      setError(err instanceof Error ? err.message : "Failed to save weight")
    }
  }

  function selectCalendarDate(dateString: string) {
    triggerLightHaptic()
    setSelectedDate(normalizeLogDate(dateString))
  }

  if (loading && weightLogs.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading weight...</Text>
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
              onRefresh={() => loadWeight(true)}
              tintColor={colors.teal}
            />
          }
        >
          <View>
            <Text style={styles.title}>Weight</Text>
            <Text style={styles.subtitle}>Daily weigh-ins and trend tracking</Text>
          </View>

          <FitCard style={styles.dateCard}>
            <Pressable onPress={() => changeDate(-1)} style={styles.dateButton}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>

            <View style={styles.dateCenter}>
              <Text style={styles.dateTitle}>
                {formatDateTitle(selectedDate)}
              </Text>
              <Text style={styles.dateSubtitle}>
                {normalizeLogDate(selectedDate)}
              </Text>
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
            <Text style={styles.heroLabel}>Weight log</Text>

            <View style={styles.weightInputShell}>
              <TextInput
                value={weightInput}
                onChangeText={updateWeightInput}
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                selectTextOnFocus
                textAlign="center"
                placeholder={latestWeight > 0 ? String(latestWeight) : "0"}
                placeholderTextColor={colors.textFaint}
                style={styles.weightInput}
              />
            </View>

            <Text style={styles.heroSubtext}>kg for selected day</Text>

            <Pressable
              onPress={saveSelectedWeight}
              disabled={!hasWeightChanges || savingStatus === "saving"}
              style={[
                styles.confirmWeightButton,
                (!hasWeightChanges || savingStatus === "saving") &&
                  styles.confirmWeightButtonDisabled,
              ]}
            >
              {savingStatus === "saving" ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.confirmWeightButtonText}>
                  {hasWeightChanges ? "Save Weight" : "Weight Saved"}
                </Text>
              )}
            </Pressable>

            <View style={styles.heroFooter}>
              <Text style={styles.heroFooterText}>
                {selectedWeight > 0
                  ? `Selected: ${formatWeight(selectedWeight)}`
                  : "No weight logged for this day"}
              </Text>

              <Text style={styles.saveStatusText}>
                {savingStatus === "saving"
                  ? "Saving..."
                  : savingStatus === "saved"
                  ? "Saved"
                  : savingStatus === "error"
                  ? "Save failed"
                  : hasWeightChanges
                  ? "Unsaved"
                  : "Ready"}
              </Text>
            </View>
          </FitCard>

          <View style={styles.tileRow}>
            <StatTile
              label="Latest"
              value={formatWeight(latestWeight)}
              detail="current trend"
              accent
            />
            <StatTile
              label="Change"
              value={formatSignedWeight(changeFromPrevious)}
              detail="since previous log"
            />
          </View>

          <View style={styles.tileRow}>
            <StatTile
              label="Goal"
              value={goalWeight ? formatWeight(goalWeight) : "—"}
              detail="profile target"
            />
            <StatTile
              label="Weekly"
              value={
                weeklyRate === null
                  ? "—"
                  : `${formatSignedWeight(Math.round(weeklyRate * 10) / 10)}/w`
              }
              detail="last 30 days"
              accent
            />
          </View>

          <FitCard>
            <Text style={styles.cardTitle}>Goal ETA</Text>

            {goalWeight && latestWeight ? (
              <>
                <Text style={styles.cardText}>
                  Goal difference:{" "}
                  {goalDifference !== null
                    ? formatSignedWeight(goalDifference)
                    : "—"}
                </Text>

                <Text style={styles.cardText}>
                  Estimated arrival: {estimatedGoalDate ?? "Not enough trend data"}
                </Text>

                <Text style={styles.cardHint}>
                  This uses your recent weight logs. Profile weight remains separate
                  for calorie recalibration.
                </Text>
              </>
            ) : (
              <Text style={styles.cardText}>
                Set a goal weight in Profile to show an ETA here.
              </Text>
            )}
          </FitCard>

          <FitCard>
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={() => changeMonth(-1)}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>

              <Text style={styles.cardTitle}>
                {formatMonthTitle(selectedMonth)}
              </Text>

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

                const log = weightByDate[cell.dateString]
                const weight = log ? roundWeight(log.weight_kg) : 0
                const selected = cell.dateString === normalizeLogDate(selectedDate)

                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => selectCalendarDate(cell.dateString)}
                    style={[
                      styles.dayCell,
                      weight > 0 ? styles.dayCellLogged : null,
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

                    <Text
                      style={[
                        styles.dayWeight,
                        selected ? styles.dayNumberSelected : null,
                        weight <= 0 ? styles.dayWeightEmpty : null,
                      ]}
                    >
                      {weight > 0 ? String(weight) : "0.0"}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </FitCard>

          <FitCard>
            <Text style={styles.cardTitle}>Recent Weight Logs</Text>

            {recentLogs.length > 0 ? (
              <View style={styles.historyList}>
                {recentLogs.map((log) => {
                  const normalizedDate = normalizeLogDate(log.log_date)

                  return (
                    <Pressable
                      key={log.id}
                      onPress={() => selectCalendarDate(normalizedDate)}
                      style={styles.historyRow}
                    >
                      <View>
                        <Text style={styles.historyDate}>
                          {formatHistoryDate(normalizedDate)}
                        </Text>
                        <Text style={styles.historyMeta}>{normalizedDate}</Text>
                      </View>

                      <Text style={styles.historyWeight}>
                        {formatWeight(log.weight_kg)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Log your first weight to start building history.
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
  weightInputShell: {
    minHeight: 76,
    marginTop: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  weightInput: {
    color: colors.text,
    fontSize: 50,
    fontWeight: "900",
    padding: 0,
    minWidth: 220,
    textAlign: "center",
  },
  heroSubtext: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },
  confirmWeightButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  confirmWeightButtonDisabled: {
    opacity: 0.55,
  },
  confirmWeightButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900",
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
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },
  cardHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: spacing.md,
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
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellLogged: {
    backgroundColor: "rgba(20, 184, 166, 0.18)",
  },
  dayCellSelected: {
    borderColor: colors.text,
  },
  dayNumber: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  dayNumberSelected: {
    color: colors.text,
  },
  dayWeight: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
  },
  dayWeightEmpty: {
    opacity: 0,
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
  historyWeight: {
    color: colors.text,
    fontSize: 16,
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