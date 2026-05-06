import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FitCard from "@/components/FitCard";
import { colors, radius, spacing } from "@/constants/fitforgeTheme";
import { deleteMobileWorkout, getMobileWorkoutHistoryItem } from "@/lib/api";
import {
  MobileActiveWorkoutResponse,
  MobileExerciseSet,
  MobileWorkoutExercise,
} from "@/types/activeWorkout";



function triggerMediumHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number | null) {
  if (!minutes || minutes <= 0) return "—";
  return `${minutes} min`;
}

function getNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCardioExercise(exercise: MobileWorkoutExercise) {
  const name = exercise.exercise_name.toLowerCase();
  const group = String(exercise.muscle_group || "").toLowerCase();

  return (
    group.includes("cardio") ||
    name.includes("treadmill") ||
    name.includes("run") ||
    name.includes("cycling") ||
    name.includes("bike") ||
    name.includes("rowing") ||
    name.includes("elliptical") ||
    name.includes("stair") ||
    name.includes("jump rope")
  );
}

function calculateVolume(exercises: MobileWorkoutExercise[]) {
  return exercises.reduce((total, exercise) => {
    return (
      total +
      exercise.sets.reduce((setTotal, set) => {
        return setTotal + getNumber(set.weight_kg) * getNumber(set.reps);
      }, 0)
    );
  }, 0);
}

function countSets(exercises: MobileWorkoutExercise[]) {
  return exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

function sortExercises(exercises: MobileWorkoutExercise[]) {
  return [...exercises].sort(
    (a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0)
  );
}

function sortSets(sets: MobileExerciseSet[]) {
  return [...sets].sort(
    (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
  );
}

export default function WorkoutHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();

  const [data, setData] = useState<MobileActiveWorkoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exercises = useMemo(() => {
    return sortExercises(data?.exercises ?? []);
  }, [data?.exercises]);

  const totalSets = useMemo(() => countSets(exercises), [exercises]);
  const volume = useMemo(() => calculateVolume(exercises), [exercises]);

  const loadWorkout = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      if (id === "index") {
        router.replace({
          pathname: "/workout-history",
        });
        return;
      }
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(!data);
        }

        setError(null);

        const response = await getMobileWorkoutHistoryItem(getToken, id);
        setData(response);
      } catch (err) {
        console.warn("Failed to load workout detail", err);
        setError(err instanceof Error ? err.message : "Failed to load workout");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [data, getToken, id]
  );

  useEffect(() => {
    loadWorkout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function goBackToHistory() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({
      pathname: "/workout-history",
    });
  }

  function confirmDeleteWorkout() {
    if (!data || deleting) return;

    triggerMediumHaptic();

    Alert.alert(
      "Delete workout?",
      "This removes the completed workout from your history.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: deleteWorkout,
        },
      ]
    );
  }

  async function deleteWorkout() {
    if (!data || deleting) return;

    try {
      setDeleting(true);
      setError(null);

      await deleteMobileWorkout(getToken, data.workout.id);

      router.replace("/workout-history");
    } catch (err) {
      console.warn("Failed to delete workout", err);
      setError(err instanceof Error ? err.message : "Failed to delete workout");
      setDeleting(false);
    }
  }

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </SafeAreaView>
    );
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
    );
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
        <View style={styles.topBar}>
          <Pressable onPress={goBackToHistory} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>{data?.workout.name || "Workout"}</Text>
            <Text style={styles.subtitle}>
              {data?.workout.performed_at
                ? formatDateTime(data.workout.performed_at)
                : "Workout detail"}
            </Text>
          </View>

          <Pressable
            onPress={confirmDeleteWorkout}
            disabled={!data || deleting}
            style={[
              styles.deleteButton,
              (!data || deleting) && styles.disabledButton,
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={colors.red} />
            ) : (
              <Ionicons name="trash-outline" size={19} color={colors.red} />
            )}
          </Pressable>
        </View>

        {error ? (
          <FitCard>
            <Text selectable style={styles.inlineError}>
              {error}
            </Text>
          </FitCard>
        ) : null}

        <FitCard accent>
          <Text style={styles.heroLabel}>Workout summary</Text>

          <View style={styles.summaryGrid}>
            <SummaryTile label="Exercises" value={String(exercises.length)} />
            <SummaryTile label="Sets" value={String(totalSets)} />
            <SummaryTile
              label="Volume"
              value={`${Math.round(volume).toLocaleString()} kg`}
            />
            <SummaryTile
              label="Duration"
              value={formatDuration(data?.workout.duration_minutes ?? null)}
            />
          </View>
        </FitCard>

        {exercises.length > 0 ? (
          <View style={styles.exerciseList}>
            {exercises.map((exercise, index) => (
              <ExerciseHistoryCard
                key={`${exercise.id}-${index}`}
                exercise={exercise}
              />
            ))}
          </View>
        ) : (
          <FitCard>
            <Text style={styles.emptyText}>
              No exercises were saved for this workout.
            </Text>
          </FitCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ExerciseHistoryCard({
  exercise,
}: {
  exercise: MobileWorkoutExercise;
}) {
  const cardio = isCardioExercise(exercise);
  const sets = sortSets(exercise.sets ?? []);

  return (
    <FitCard style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseTitleBlock}>
          <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
          <Text style={styles.exerciseMuscle}>
            {cardio ? "cardio" : exercise.muscle_group || "other"}
          </Text>
        </View>

        <View style={styles.exerciseCountPill}>
          <Text style={styles.exerciseCountText}>{sets.length}</Text>
        </View>
      </View>

      {sets.length > 0 ? (
        <View style={styles.setList}>
          {sets.map((set) =>
            cardio ? (
              <CardioHistorySet key={set.id} set={set} />
            ) : (
              <StrengthHistorySet key={set.id} set={set} />
            )
          )}
        </View>
      ) : (
        <Text style={styles.emptySetText}>No sets saved.</Text>
      )}
    </FitCard>
  );
}

function StrengthHistorySet({ set }: { set: MobileExerciseSet }) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setNumber}>Set {set.set_number}</Text>
      <Text style={styles.setValue}>
        {getNumber(set.weight_kg)} kg × {getNumber(set.reps)}
      </Text>
      {set.completed ? (
        <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
      ) : (
        <View style={styles.setStatusSpacer} />
      )}
    </View>
  );
}

function CardioHistorySet({ set }: { set: MobileExerciseSet }) {
  return (
    <View style={styles.cardioSetBox}>
      <View style={styles.cardioSetTopRow}>
        <Text style={styles.setNumber}>Entry {set.set_number}</Text>
        {set.completed ? (
          <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
        ) : null}
      </View>

      <View style={styles.cardioGrid}>
        <MiniStat label="Speed" value={String(getNumber(set.speed))} />
        <MiniStat
          label="Time"
          value={`${getNumber(set.duration_minutes)} min`}
        />
        <MiniStat label="Distance" value={`${getNumber(set.distance)} km`} />
        <MiniStat label="Incline" value={`${getNumber(set.incline)}%`} />
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
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
  retryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
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
    fontSize: 24,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  deleteButton: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderColor: colors.red,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.55,
  },
  inlineError: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  heroLabel: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryTile: {
    width: "48%",
    minHeight: 74,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
    textTransform: "uppercase",
  },
  exerciseList: {
    gap: spacing.md,
  },
  exerciseCard: {
    padding: spacing.md,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  exerciseTitleBlock: {
    flex: 1,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  exerciseMuscle: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
    textTransform: "capitalize",
  },
  exerciseCountPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseCountText: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: "900",
  },
  setList: {
    gap: spacing.sm,
  },
  setRow: {
    minHeight: 46,
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
  setNumber: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  setValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  setStatusSpacer: {
    width: 18,
  },
  cardioSetBox: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardioSetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  miniStat: {
    flexGrow: 1,
    minWidth: "45%",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  miniStatValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  miniStatLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySetText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
});
