import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FitCard from "@/components/FitCard";
import StatTile from "@/components/StatTile";
import { colors, radius, spacing } from "@/constants/fitforgeTheme";
import {
  completeMobileGoal,
  createMobileGoal,
  deleteMobileGoal,
  getMobileGoalCompletions,
  getMobileGoals,
  uncompleteMobileGoal,
  updateMobileGoal,
} from "@/lib/api";
import {
  GoalColor,
  MobileGoal,
  MobileGoalCompletion,
  MobileGoalPayload,
} from "@/types/goals";

const GOAL_COLORS: GoalColor[] = [
  "teal",
  "blue",
  "green",
  "purple",
  "orange",
  "red",
];

type GoalFormState = {
  id?: string;
  name: string;
  emoji: string;
  color: GoalColor;
  target_days_per_week: string;
  emojiTouched: boolean;
};

function triggerLightHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

function triggerMediumHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

function makeTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDate(value: unknown) {
  if (!value) return getLocalDateString();

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    return getLocalDateString(value);
  }

  return String(value).slice(0, 10);
}
function suggestGoalEmoji(name: string) {
  const text = name.toLowerCase();

  if (text.includes("water") || text.includes("drink")) return "💧";
  if (text.includes("run") || text.includes("jog")) return "🏃";
  if (text.includes("walk") || text.includes("steps")) return "🚶";
  if (text.includes("gym") || text.includes("workout") || text.includes("lift"))
    return "🏋️";
  if (text.includes("stretch") || text.includes("mobility")) return "🤸";
  if (text.includes("read") || text.includes("book")) return "📖";
  if (text.includes("study") || text.includes("learn")) return "🧠";
  if (text.includes("sleep") || text.includes("bed")) return "😴";
  if (text.includes("meditate") || text.includes("mindful")) return "🧘";
  if (text.includes("protein") || text.includes("food") || text.includes("eat"))
    return "🥗";
  if (text.includes("calorie") || text.includes("diet")) return "🍽️";
  if (text.includes("weight")) return "⚖️";
  if (text.includes("journal") || text.includes("write")) return "✍️";
  if (text.includes("clean")) return "🧹";
  if (text.includes("vitamin") || text.includes("supplement")) return "💊";

  return "🎯";
}

function clampTargetDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(7, Math.max(1, Math.round(parsed)));
}
function shiftDate(dateString: string, days: number) {
  const date = new Date(`${normalizeDate(dateString)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function formatDateTitle(dateString: string) {
  const normalized = normalizeDate(dateString);
  const today = getLocalDateString();
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);

  if (normalized === today) return "Today";
  if (normalized === yesterday) return "Yesterday";
  if (normalized === tomorrow) return "Tomorrow";

  const date = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(date.getTime())) return normalized;

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    from: getLocalDateString(start),
    to: getLocalDateString(end),
  };
}

function getWeekRange(dateString = getLocalDateString()) {
  const date = new Date(`${normalizeDate(dateString)}T12:00:00`);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());

  const days = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return getLocalDateString(day);
  });

  return days;
}

function getMonthGrid(selectedMonth: Date) {
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();

  const cells: ({ key: string; day: number; dateString: string } | null)[] = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);

    cells.push({
      key: getLocalDateString(date),
      day,
      dateString: getLocalDateString(date),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function normalizeGoal(goal: MobileGoal): MobileGoal {
  return {
    ...goal,
    emoji: goal.emoji || "🎯",
    color: goal.color || "teal",
    order_index: Number(goal.order_index ?? 0),
    active: Boolean(goal.active ?? true),
    target_days_per_week: clampTargetDays(goal.target_days_per_week ?? 7),
  };
}

function normalizeCompletion(
  completion: MobileGoalCompletion
): MobileGoalCompletion {
  return {
    ...completion,
    completed_date: normalizeDate(completion.completed_date),
  };
}

function emptyForm(): GoalFormState {
  return {
    name: "",
    emoji: "🎯",
    color: "teal",
    target_days_per_week: "7",
    emojiTouched: false,
  };
}

function goalToForm(goal: MobileGoal): GoalFormState {
  return {
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji || "🎯",
    color: (goal.color as GoalColor) || "teal",
    target_days_per_week: String(
      clampTargetDays(goal.target_days_per_week ?? 7)
    ),
    emojiTouched: true,
  };
}

function colorValue(color: string) {
  if (color === "blue") return "#38bdf8";
  if (color === "green") return "#22c55e";
  if (color === "purple") return "#a78bfa";
  if (color === "orange") return "#fb923c";
  if (color === "red") return "#f87171";
  return colors.teal;
}

function formToPayload(form: GoalFormState): MobileGoalPayload {
  return {
    name: form.name.trim(),
    emoji: form.emoji.trim() || suggestGoalEmoji(form.name),
    color: form.color || "teal",
    target_days_per_week: clampTargetDays(form.target_days_per_week),
  };
}

export default function GoalsScreen() {
  const { getToken } = useAuth();

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [goals, setGoals] = useState<MobileGoal[]>([]);
  const [completions, setCompletions] = useState<MobileGoalCompletion[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GoalFormState>(() => emptyForm());

  const activeGoals = useMemo(() => {
    return goals
      .filter((goal) => goal.active !== false)
      .sort(
        (a, b) =>
          Number(a.order_index ?? 0) - Number(b.order_index ?? 0) ||
          a.name.localeCompare(b.name)
      );
  }, [goals]);

  const completionsByDate = useMemo(() => {
    return completions.reduce<Record<string, Set<string>>>(
      (map, completion) => {
        const date = normalizeDate(completion.completed_date);

        if (!map[date]) {
          map[date] = new Set();
        }

        map[date].add(completion.goal_id);
        return map;
      },
      {}
    );
  }, [completions]);

  const selectedCompletions = completionsByDate[normalizeDate(selectedDate)];
  const completedTodayCount = selectedCompletions?.size ?? 0;

  const selectedProgress =
    activeGoals.length > 0 ? completedTodayCount / activeGoals.length : 0;

  const weekDays = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  const weeklyCountsByGoal = useMemo(() => {
    return activeGoals.reduce<Record<string, number>>((map, goal) => {
      map[goal.id] = weekDays.filter((day) =>
        completionsByDate[day]?.has(goal.id)
      ).length;

      return map;
    }, {});
  }, [activeGoals, completionsByDate, weekDays]);

  const monthCells = useMemo(() => {
    return getMonthGrid(selectedMonth);
  }, [selectedMonth]);

  const loadGoals = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(goals.length === 0);
        }

        setError(null);

        const range = getMonthRange(selectedMonth);

        const [goalRows, completionRows] = await Promise.all([
          getMobileGoals(getToken),
          getMobileGoalCompletions(getToken, range.from, range.to),
        ]);

        setGoals(Array.isArray(goalRows) ? goalRows.map(normalizeGoal) : []);
        setCompletions(
          Array.isArray(completionRows)
            ? completionRows.map(normalizeCompletion)
            : []
        );
      } catch (err) {
        console.warn("Failed to load goals", err);
        setError(err instanceof Error ? err.message : "Failed to load goals");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getToken, goals.length, selectedMonth]
  );

  useEffect(() => {
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadGoals(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  function changeDate(days: number) {
    triggerLightHaptic();
    setSelectedDate((current) => shiftDate(current, days));
  }

  function changeMonth(direction: -1 | 1) {
    triggerLightHaptic();

    setSelectedMonth((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + direction);
      return next;
    });
  }

  function openCreateGoal() {
    triggerMediumHaptic();
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEditGoal(goal: MobileGoal) {
    triggerLightHaptic();
    setForm(goalToForm(goal));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setSaving(false);
  }

  function updateFormField(field: keyof GoalFormState, value: string) {
    setForm((current) => {
      if (field === "name") {
        const nextName = value;
        const suggestedEmoji = suggestGoalEmoji(nextName);

        return {
          ...current,
          name: nextName,
          emoji: current.emojiTouched ? current.emoji : suggestedEmoji,
        };
      }

      if (field === "emoji") {
        return {
          ...current,
          emoji: value.slice(0, 4),
          emojiTouched: true,
        };
      }

      if (field === "target_days_per_week") {
        const cleaned = value.replace(/[^0-9]/g, "");

        return {
          ...current,
          target_days_per_week: cleaned,
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  async function saveGoal() {
    if (saving) return;

    const payload = formToPayload(form);

    if (!payload.name) {
      setError("Goal name is required.");
      return;
    }

    triggerMediumHaptic();
    setSaving(true);
    setError(null);

    if (form.id) {
      const previousGoals = goals;

      setGoals((current) =>
        current.map((goal) =>
          goal.id === form.id
            ? {
                ...goal,
                ...payload,
              }
            : goal
        )
      );

      closeForm();

      updateMobileGoal(getToken, form.id, payload)
        .then((updatedGoal) => {
          setGoals((current) =>
            current.map((goal) =>
              goal.id === form.id ? normalizeGoal(updatedGoal) : goal
            )
          );
        })
        .catch((err: unknown) => {
          console.warn("Failed to update goal", err);
          setGoals(previousGoals);
          setError(
            err instanceof Error ? err.message : "Failed to update goal"
          );
        });

      return;
    }

    const tempId = makeTempId("temp-goal");

    const optimisticGoal: MobileGoal = {
      id: tempId,
      name: payload.name,
      emoji: payload.emoji,
      color: payload.color,
      order_index: goals.length,
      active: true,
      target_days_per_week: payload.target_days_per_week,
      isTemp: true,
    };

    setGoals((current) => [...current, optimisticGoal]);
    closeForm();

    createMobileGoal(getToken, payload)
      .then((createdGoal) => {
        setGoals((current) =>
          current.map((goal) =>
            goal.id === tempId ? normalizeGoal(createdGoal) : goal
          )
        );
      })
      .catch((err: unknown) => {
        console.warn("Failed to create goal", err);
        setGoals((current) => current.filter((goal) => goal.id !== tempId));
        setError(err instanceof Error ? err.message : "Failed to create goal");
      });
  }

  function toggleGoalCompletion(goal: MobileGoal) {
    const date = normalizeDate(selectedDate);
    const currentlyComplete = completionsByDate[date]?.has(goal.id);

    triggerLightHaptic();
    setError(null);

    if (currentlyComplete) {
      const previousCompletions = completions;

      setCompletions((current) =>
        current.filter(
          (completion) =>
            !(
              completion.goal_id === goal.id &&
              normalizeDate(completion.completed_date) === date
            )
        )
      );

      uncompleteMobileGoal(getToken, goal.id, date).catch((err: unknown) => {
        console.warn("Failed to uncomplete goal", err);
        setCompletions(previousCompletions);
        setError(
          err instanceof Error ? err.message : "Failed to update completion"
        );
      });

      return;
    }

    const tempCompletion: MobileGoalCompletion = {
      id: makeTempId("temp-completion"),
      goal_id: goal.id,
      completed_date: date,
      isTemp: true,
    };

    setCompletions((current) => [...current, tempCompletion]);

    completeMobileGoal(getToken, goal.id, date)
      .then((createdCompletion) => {
        setCompletions((current) =>
          current.map((completion) =>
            completion.id === tempCompletion.id
              ? normalizeCompletion(createdCompletion)
              : completion
          )
        );
      })
      .catch((err: unknown) => {
        console.warn("Failed to complete goal", err);
        setCompletions((current) =>
          current.filter((completion) => completion.id !== tempCompletion.id)
        );
        setError(
          err instanceof Error ? err.message : "Failed to update completion"
        );
      });
  }

  function confirmDeleteGoal(goal: MobileGoal) {
    triggerLightHaptic();

    Alert.alert(
      "Delete goal?",
      `Delete ${goal.emoji} ${goal.name}? Your completion history will be preserved.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteGoal(goal),
        },
      ]
    );
  }

  function deleteGoal(goal: MobileGoal) {
    const previousGoals = goals;

    setGoals((current) => current.filter((item) => item.id !== goal.id));

    if (goal.isTemp || goal.id.startsWith("temp")) {
      return;
    }

    deleteMobileGoal(getToken, goal.id).catch((err: unknown) => {
      console.warn("Failed to delete goal", err);
      setGoals(previousGoals);
      setError(err instanceof Error ? err.message : "Failed to delete goal");
    });
  }

  if (loading && goals.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading goals...</Text>
      </SafeAreaView>
    );
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
              onRefresh={() => loadGoals(true)}
              tintColor={colors.teal}
            />
          }
        >
          <View>
            <Text style={styles.title}>Goals</Text>
            <Text style={styles.subtitle}>Daily habits and consistency</Text>
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
                {normalizeDate(selectedDate)}
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

          <View style={styles.tileRow}>
            <StatTile
              label="Completed"
              value={`${completedTodayCount}/${activeGoals.length}`}
              detail="selected day"
              accent
            />
            <StatTile
              label="Progress"
              value={`${Math.round(selectedProgress * 100)}%`}
              detail="daily goals"
            />
          </View>

          <Pressable
            onPress={openCreateGoal}
            style={({ pressed }) => [
              styles.addGoalButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons name="add" size={20} color={colors.background} />
            <Text style={styles.addGoalText}>Add Goal</Text>
          </Pressable>

          <View style={styles.goalList}>
            {activeGoals.length > 0 ? (
              activeGoals.map((goal) => {
                const completed = Boolean(
                  completionsByDate[normalizeDate(selectedDate)]?.has(goal.id)
                );
                const weeklyCount = weeklyCountsByGoal[goal.id] ?? 0;

                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    completed={completed}
                    weeklyCount={weeklyCount}
                    onToggle={() => toggleGoalCompletion(goal)}
                    onEdit={() => openEditGoal(goal)}
                    onDelete={() => confirmDeleteGoal(goal)}
                  />
                );
              })
            ) : (
              <FitCard>
                <Text style={styles.emptyTitle}>No goals yet</Text>
                <Text style={styles.emptyText}>
                  Add a daily habit like water, stretching, reading, or steps.
                </Text>
              </FitCard>
            )}
          </View>

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

            <Text style={styles.cardText}>
              Daily intensity is based on completed goals divided by active
              goals.
            </Text>

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
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const completeCount =
                  completionsByDate[cell.dateString]?.size ?? 0;
                const ratio =
                  activeGoals.length > 0
                    ? completeCount / activeGoals.length
                    : 0;
                const selected =
                  cell.dateString === normalizeDate(selectedDate);

                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => setSelectedDate(cell.dateString)}
                    style={[
                      styles.dayCell,
                      ratio <= 0
                        ? styles.dayCell_none
                        : ratio < 0.5
                        ? styles.dayCell_low
                        : ratio < 1
                        ? styles.dayCell_medium
                        : styles.dayCell_full,
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
                        styles.dayMeta,
                        selected ? styles.dayNumberSelected : null,
                        completeCount <= 0 ? styles.dayMetaEmpty : null,
                      ]}
                    >
                      {completeCount}/{activeGoals.length || 0}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FitCard>

          <FitCard>
            <Text style={styles.cardTitle}>This Week</Text>

            {activeGoals.length > 0 ? (
              <View style={styles.weeklyList}>
                {activeGoals.map((goal) => {
                  const count = weeklyCountsByGoal[goal.id] ?? 0;

                  return (
                    <View key={goal.id} style={styles.weeklyRow}>
                      <Text style={styles.weeklyEmoji}>{goal.emoji}</Text>

                      <View style={styles.weeklyMain}>
                        <View style={styles.weeklyHeader}>
                          <Text style={styles.weeklyName}>{goal.name}</Text>
                          <Text style={styles.weeklyCount}>
                            {count}/
                            {clampTargetDays(goal.target_days_per_week ?? 7)}
                          </Text>
                        </View>

                        <View style={styles.weeklyTrack}>
                          <View
                            style={[
                              styles.weeklyFill,
                              {
                                width: `${Math.min(
                                  100,
                                  (count /
                                    clampTargetDays(
                                      goal.target_days_per_week ?? 7
                                    )) *
                                    100
                                )}%`,
                                backgroundColor: colorValue(goal.color),
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Weekly stats will appear once you add goals.
              </Text>
            )}
          </FitCard>
        </ScrollView>

        <GoalFormModal
          visible={showForm}
          form={form}
          saving={saving}
          onClose={closeForm}
          onChange={updateFormField}
          onSave={saveGoal}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoalCard({
  goal,
  completed,
  weeklyCount,
  onToggle,
  onEdit,
  onDelete,
}: {
  goal: MobileGoal;
  completed: boolean;
  weeklyCount: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accentColor = colorValue(goal.color);

  return (
    <FitCard style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={styles.goalLeft}>
          <Text style={styles.goalEmoji}>{goal.emoji}</Text>

          <View style={styles.goalTextBlock}>
            <Text style={styles.goalName}>{goal.name}</Text>
            <Text style={styles.goalMeta}>
              {weeklyCount}/{clampTargetDays(goal.target_days_per_week ?? 7)}{" "}
              this week
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onToggle}
          style={[
            styles.goalToggle,
            {
              borderColor: accentColor,
              backgroundColor: completed ? accentColor : "transparent",
            },
          ]}
        >
          {completed ? (
            <Ionicons name="checkmark" size={22} color={colors.background} />
          ) : null}
        </Pressable>
      </View>

      <View style={styles.goalFooter}>
        <Pressable onPress={onEdit} style={styles.goalAction}>
          <Ionicons name="create-outline" size={16} color={colors.textMuted} />
          <Text style={styles.goalActionText}>Edit</Text>
        </Pressable>

        <Pressable onPress={onDelete} style={styles.goalAction}>
          <Ionicons name="trash-outline" size={16} color={colors.red} />
          <Text style={[styles.goalActionText, styles.dangerText]}>Delete</Text>
        </Pressable>
      </View>
    </FitCard>
  );
}

function GoalFormModal({
  visible,
  form,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  visible: boolean;
  form: GoalFormState;
  saving: boolean;
  onClose: () => void;
  onChange: (field: keyof GoalFormState, value: string) => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {form.id ? "Edit Goal" : "Add Goal"}
            </Text>

            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <TextInput
            value={form.name}
            onChangeText={(value) => onChange("name", value)}
            placeholder="Goal name"
            placeholderTextColor={colors.textFaint}
            style={styles.nameInput}
          />

          <TextInput
            value={form.emoji}
            onChangeText={(value) => onChange("emoji", value)}
            placeholder="Emoji"
            placeholderTextColor={colors.textFaint}
            style={styles.emojiInput}
          />

          <Text style={styles.modalLabel}>Days per week</Text>

          <View style={styles.daysSelector}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const active = String(day) === form.target_days_per_week;

              return (
                <Pressable
                  key={day}
                  onPress={() => onChange("target_days_per_week", String(day))}
                  style={[
                    styles.dayOption,
                    active ? styles.dayOptionActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayOptionText,
                      active ? styles.dayOptionTextActive : null,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.modalLabel}>Color</Text>

          <View style={styles.colorRow}>
            {GOAL_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => onChange("color", color)}
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: colorValue(color),
                    borderColor:
                      form.color === color ? colors.text : "transparent",
                  },
                ]}
              />
            ))}
          </View>

          <Pressable
            onPress={onSave}
            disabled={saving}
            style={[styles.modalSaveButton, saving && styles.disabledButton]}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.modalSaveText}>
                {form.id ? "Save Goal" : "Create Goal"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
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
  tileRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  addGoalButton: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addGoalText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  goalList: {
    gap: spacing.md,
  },
  goalCard: {
    padding: spacing.md,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  goalLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  goalEmoji: {
    fontSize: 34,
  },
  goalTextBlock: {
    flex: 1,
  },
  goalName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  goalMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  goalToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  goalAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  goalActionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  dangerText: {
    color: colors.red,
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
    textAlign: "center",
    marginTop: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  cardText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginBottom: spacing.md,
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
  dayCell_none: {
    backgroundColor: colors.surfaceLight,
  },
  dayCell_low: {
    backgroundColor: "rgba(20, 184, 166, 0.14)",
  },
  dayCell_medium: {
    backgroundColor: "rgba(20, 184, 166, 0.34)",
  },
  dayCell_full: {
    backgroundColor: colors.teal,
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
  dayMeta: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
  },
  dayMetaEmpty: {
    opacity: 0,
  },
  weeklyList: {
    gap: spacing.md,
  },
  weeklyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  weeklyEmoji: {
    fontSize: 24,
  },
  weeklyMain: {
    flex: 1,
  },
  weeklyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weeklyName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  weeklyCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  weeklyTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    overflow: "hidden",
    marginTop: 6,
  },
  weeklyFill: {
    height: "100%",
    borderRadius: 999,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "android" ? 42 : 64,
    paddingBottom: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 410,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
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
  nameInput: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  emojiInput: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  modalLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  colorRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  colorDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
  },
  modalSaveButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  modalSaveText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  daysSelector: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dayOption: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayOptionActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  dayOptionText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
  },
  dayOptionTextActive: {
    color: colors.background,
  },
});
