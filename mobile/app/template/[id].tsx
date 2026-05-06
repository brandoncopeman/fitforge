import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FitCard from "@/components/FitCard";
import { colors, radius, spacing } from "@/constants/fitforgeTheme";
import {
  setCachedActiveWorkout,
  setCachedActiveWorkoutForId,
} from "@/lib/activeWorkoutCache";
import {
  createMobileTemplate,
  getMobileTemplates,
  MobileExerciseSearchResult,
  overwriteMobileTemplateFromWorkout,
  searchMobileExercises,
  startMobileWorkout,
  updateMobileTemplatePlanStatus,
} from "@/lib/api";
import {
  deleteDraftTemplate,
  getDraftTemplate,
  isDraftTemplateId,
  setDraftTemplate,
} from "@/lib/draftTemplateCache";
import { buildDraftWorkoutFromTemplate } from "@/lib/draftWorkout";
import { getCachedTemplates, setCachedTemplates } from "@/lib/templatesCache";
import {
  MobileTemplateExercise,
  MobileTemplatesResponse,
  MobileWorkoutTemplate,
} from "@/types/workouts";

type SavingStatus = "idle" | "draft" | "saving" | "saved" | "error";
type TemplateExercisePatch = Partial<MobileTemplateExercise>;

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

function makeLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatExerciseCount(count: number) {
  return `${count} exercise${count === 1 ? "" : "s"}`;
}

function normalizeTemplatesResponse(
  response: MobileTemplatesResponse | null,
): MobileTemplatesResponse {
  return {
    templates: Array.isArray(response?.templates) ? response.templates : [],
    plan: {
      lastPlanIndex: response?.plan?.lastPlanIndex ?? -1,
      nextPlanIndex: response?.plan?.nextPlanIndex ?? -1,
      nextTemplate: response?.plan?.nextTemplate ?? null,
    },
  };
}

function sortTemplateExercises(exercises: MobileTemplateExercise[]) {
  return [...exercises].sort(
    (a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0),
  );
}

function isCardioTemplateExercise(exercise: MobileTemplateExercise) {
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

function isCardioSearchResult(result: MobileExerciseSearchResult) {
  const name = result.name.toLowerCase();
  const group = String(
    result.target || result.muscle_group || result.bodyPart || "",
  ).toLowerCase();

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

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDecimalInput(value: string) {
  const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDotIndex = cleaned.indexOf(".");

  if (firstDotIndex === -1) {
    return cleaned;
  }

  return (
    cleaned.slice(0, firstDotIndex + 1) +
    cleaned.slice(firstDotIndex + 1).replace(/\./g, "")
  );
}

function normalizeIntegerInput(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function getTemplateFromCache(templateId: string) {
  if (isDraftTemplateId(templateId)) {
    return getDraftTemplate(templateId);
  }

  const cached = getCachedTemplates();
  if (!cached) return null;

  const normalized = normalizeTemplatesResponse(cached);

  return (
    normalized.templates.find((template) => template.id === templateId) ??
    (normalized.plan.nextTemplate?.id === templateId
      ? normalized.plan.nextTemplate
      : null)
  );
}

function buildTemplatePayload(template: MobileWorkoutTemplate) {
  return sortTemplateExercises(template.exercises ?? []).map(
    (exercise, index) => {
      const cardio = isCardioTemplateExercise(exercise);

      return {
        exercise_name: exercise.exercise_name,
        muscle_group: cardio ? "cardio" : exercise.muscle_group || "other",
        order_index: index,
        default_sets: Math.max(1, toNumber(exercise.default_sets, 1)),
        default_reps: cardio ? 0 : toNumber(exercise.default_reps, 8),
        default_weight_kg: cardio ? 0 : toNumber(exercise.default_weight_kg, 0),
        default_duration_minutes: cardio
          ? (exercise.default_duration_minutes ?? 20)
          : null,
        default_speed: cardio ? (exercise.default_speed ?? 0) : null,
        default_distance: cardio ? (exercise.default_distance ?? 0) : null,
        default_incline: cardio ? (exercise.default_incline ?? 0) : null,
      };
    },
  );
}

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const isDraftTemplate = Boolean(id && isDraftTemplateId(id));

  const [template, setTemplate] = useState<MobileWorkoutTemplate | null>(() => {
    if (!id) return null;
    return getTemplateFromCache(id);
  });

  const [loading, setLoading] = useState(() => {
    if (!id) return false;
    return !getTemplateFromCache(id);
  });

  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<SavingStatus>(() =>
    isDraftTemplate ? "draft" : "idle",
  );
  const [starting, setStarting] = useState(false);

  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<
    MobileExerciseSearchResult[]
  >([]);
  const [searchingExercises, setSearchingExercises] = useState(false);

  const templateRef = useRef<MobileWorkoutTemplate | null>(template);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSaveStartedAtRef = useRef(0);
  const didInitialLoadRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const saveTemplateNowRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  const exercises = useMemo(() => {
    return sortTemplateExercises(template?.exercises ?? []);
  }, [template?.exercises]);

  const exerciseCount = exercises.length;

  const setTemplateOptimistic = useCallback(
    (updater: (current: MobileWorkoutTemplate) => MobileWorkoutTemplate) => {
      const current = templateRef.current;

      if (!current) return;

      const next = updater(current);

      templateRef.current = next;
      setTemplate(next);
    },
    [],
  );

  const saveTemplateNow = useCallback(async () => {
    const current = templateRef.current;
    if (!current) return;

    if (isDraftTemplateId(current.id)) {
      setDraftTemplate(current);
      hasUnsavedChangesRef.current = true;
      setSavingStatus("draft");
      return;
    }

    const saveStartedAt = Date.now();
    latestSaveStartedAtRef.current = saveStartedAt;

    setSavingStatus("saving");

    try {
      const payload = buildTemplatePayload(current);

      await Promise.all([
        overwriteMobileTemplateFromWorkout(getToken, current.id, payload),
        updateMobileTemplatePlanStatus(getToken, current.id, {
          name: current.name,
        }),
      ]);

      if (latestSaveStartedAtRef.current !== saveStartedAt) {
        return;
      }

      hasUnsavedChangesRef.current = false;
      setSavingStatus("saved");
    } catch (err) {
      console.warn("Failed to save template", err);

      if (latestSaveStartedAtRef.current === saveStartedAt) {
        setSavingStatus("error");
      }
    }
  }, [getToken]);

  useEffect(() => {
    saveTemplateNowRef.current = saveTemplateNow;
  }, [saveTemplateNow]);

  const scheduleSave = useCallback(() => {
    hasUnsavedChangesRef.current = true;

    const current = templateRef.current;

    if (current && isDraftTemplateId(current.id)) {
      setDraftTemplate(current);
      setSavingStatus("draft");
      return;
    }

    setSavingStatus("saving");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;

      saveTemplateNowRef.current?.().catch((err: unknown) => {
        console.warn("Failed to save template from debounce", err);
      });
    }, 250);
  }, []);

  const loadTemplate = useCallback(async () => {
    if (!id || didInitialLoadRef.current) return;

    didInitialLoadRef.current = true;

    const cachedTemplate = getTemplateFromCache(id);

    if (cachedTemplate) {
      templateRef.current = cachedTemplate;
      setTemplate(cachedTemplate);
      setSavingStatus(isDraftTemplateId(cachedTemplate.id) ? "draft" : "idle");
      setLoading(false);
      setError(null);
      return;
    }

    if (isDraftTemplateId(id)) {
      setError("Draft template not found");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const response = await getMobileTemplates(getToken);
      const normalized = normalizeTemplatesResponse(response);
      const foundTemplate = normalized.templates.find((item) => item.id === id);

      if (!foundTemplate) {
        setError("Template not found");
        return;
      }

      templateRef.current = foundTemplate;
      setTemplate(foundTemplate);
    } catch (err) {
      console.warn("Failed to load template", err);

      if (!templateRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load template",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    didInitialLoadRef.current = false;
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (
        hasUnsavedChangesRef.current &&
        templateRef.current &&
        !isDraftTemplateId(templateRef.current.id)
      ) {
        saveTemplateNowRef.current?.().catch((err: unknown) => {
          console.warn("Failed to flush template save on unmount", err);
        });
      }

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, []);

  function publishTemplateToWorkoutCache() {
    const current = templateRef.current;
    if (!current || isDraftTemplateId(current.id)) return;

    const cached = normalizeTemplatesResponse(getCachedTemplates());

    const finalizedTemplate: MobileWorkoutTemplate = {
      ...current,
      exercises: sortTemplateExercises(current.exercises ?? []),
      exercise_count: current.exercises?.length ?? 0,
    };

    const templateExists = cached.templates.some(
      (templateItem) => templateItem.id === finalizedTemplate.id,
    );

    const nextTemplates = templateExists
      ? cached.templates.map((templateItem) =>
          templateItem.id === finalizedTemplate.id
            ? finalizedTemplate
            : templateItem,
        )
      : [finalizedTemplate, ...cached.templates];

    const nextTemplate =
      cached.plan.nextTemplate?.id === finalizedTemplate.id
        ? finalizedTemplate
        : cached.plan.nextTemplate;

    setCachedTemplates({
      ...cached,
      templates: nextTemplates,
      plan: {
        ...cached.plan,
        nextTemplate,
      },
    });
  }

  function goBackToWorkouts() {
    router.replace("/(tabs)/workouts");
  }

  function draftHasMeaningfulChanges(templateValue: MobileWorkoutTemplate) {
    const nameChanged =
      templateValue.name.trim().length > 0 &&
      templateValue.name.trim() !== "New Template";

    const hasExercises = (templateValue.exercises ?? []).length > 0;

    return nameChanged || hasExercises || hasUnsavedChangesRef.current;
  }

  function handleBack() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const current = templateRef.current;

    if (current && isDraftTemplateId(current.id)) {
      if (!draftHasMeaningfulChanges(current)) {
        deleteDraftTemplate(current.id);
        goBackToWorkouts();
        return;
      }

      Alert.alert("Save template?", "You have an unsaved template draft.", [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            deleteDraftTemplate(current.id);
            goBackToWorkouts();
          },
        },
        {
          text: "Save Template",
          onPress: () => {
            saveDraftTemplate().catch((err: unknown) => {
              console.warn("Failed to save draft from back prompt", err);
            });
          },
        },
      ]);

      return;
    }

    publishTemplateToWorkoutCache();

    if (hasUnsavedChangesRef.current) {
      saveTemplateNowRef.current?.().catch((err: unknown) => {
        console.warn("Failed to save template before leaving", err);
      });
    }

    goBackToWorkouts();
  }

  function updateTemplateName(value: string) {
    setTemplateOptimistic((current) => ({
      ...current,
      name: value,
    }));

    scheduleSave();
  }

  function updateExercise(
    exerciseId: string,
    patch: TemplateExercisePatch,
    shouldSave = true,
  ) {
    setTemplateOptimistic((current) => {
      const nextExercises = sortTemplateExercises(current.exercises ?? []).map(
        (exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                ...patch,
              }
            : exercise,
      );

      return {
        ...current,
        exercises: nextExercises,
        exercise_count: nextExercises.length,
      };
    });

    if (shouldSave) {
      scheduleSave();
    }
  }

  function updateExerciseIntegerField(
    exerciseId: string,
    field: "default_sets" | "default_reps",
    value: string,
  ) {
    const cleaned = normalizeIntegerInput(value);
    const numberValue = cleaned === "" ? 0 : Number(cleaned);

    updateExercise(exerciseId, {
      [field]: numberValue,
    });
  }

  function updateExerciseDecimalField(
    exerciseId: string,
    field:
      | "default_weight_kg"
      | "default_duration_minutes"
      | "default_speed"
      | "default_distance"
      | "default_incline",
    value: string,
  ) {
    updateExercise(exerciseId, {
      [field]: normalizeDecimalInput(value),
    } as TemplateExercisePatch);
  }

  function moveExercise(exerciseId: string, direction: -1 | 1) {
    const current = templateRef.current;
    if (!current) return;

    const sorted = sortTemplateExercises(current.exercises ?? []);
    const currentIndex = sorted.findIndex(
      (exercise) => exercise.id === exerciseId,
    );

    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sorted.length) {
      return;
    }

    triggerLightHaptic();

    const reordered = [...sorted];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    const nextExercises = reordered.map((exercise, index) => ({
      ...exercise,
      order_index: index,
    }));

    setTemplateOptimistic((templateValue) => ({
      ...templateValue,
      exercises: nextExercises,
      exercise_count: nextExercises.length,
    }));

    scheduleSave();
  }

  function removeExercise(exerciseId: string) {
    triggerLightHaptic();

    setTemplateOptimistic((current) => {
      const nextExercises = sortTemplateExercises(current.exercises ?? [])
        .filter((exercise) => exercise.id !== exerciseId)
        .map((exercise, index) => ({
          ...exercise,
          order_index: index,
        }));

      return {
        ...current,
        exercises: nextExercises,
        exercise_count: nextExercises.length,
      };
    });

    scheduleSave();
  }

  function addExercise(result: MobileExerciseSearchResult) {
    const current = templateRef.current;
    if (!current) return;

    triggerMediumHaptic();

    const cardio = isCardioSearchResult(result);
    const exerciseIndex = current.exercises?.length ?? 0;

    const newExercise: MobileTemplateExercise = {
      id: makeLocalId("local-template-exercise"),
      template_id: current.id,
      exercise_name: result.name,
      muscle_group: cardio
        ? "cardio"
        : result.target || result.muscle_group || result.bodyPart || "other",
      order_index: exerciseIndex,
      default_sets: 1,
      default_reps: cardio ? 0 : 8,
      default_weight_kg: 0,
      default_duration_minutes: cardio ? 20 : null,
      default_speed: cardio ? 0 : null,
      default_distance: cardio ? 0 : null,
      default_incline: cardio ? 0 : null,
    };

    setTemplateOptimistic((templateValue) => {
      const nextExercises = [
        ...sortTemplateExercises(templateValue.exercises ?? []),
        newExercise,
      ].map((exercise, index) => ({
        ...exercise,
        order_index: index,
      }));

      return {
        ...templateValue,
        exercises: nextExercises,
        exercise_count: nextExercises.length,
      };
    });

    setShowExerciseSearch(false);
    setExerciseQuery("");
    setExerciseResults([]);
    setSearchingExercises(false);
    scheduleSave();
  }

  function handleExerciseSearchInput(value: string) {
    setExerciseQuery(value);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length < 2) {
      setSearchingExercises(false);
      setExerciseResults([]);
      return;
    }

    setSearchingExercises(true);

    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;

      searchMobileExercises(getToken, trimmedValue)
        .then((results) => {
          setExerciseResults(Array.isArray(results) ? results : []);
        })
        .catch((err: unknown) => {
          console.warn("Failed to search exercises", err);
          setExerciseResults([]);
        })
        .finally(() => {
          setSearchingExercises(false);
        });
    }, 250);
  }

  async function saveDraftTemplate() {
    const current = templateRef.current;

    if (
      !current ||
      !isDraftTemplateId(current.id) ||
      savingStatus === "saving"
    ) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    try {
      triggerMediumHaptic();
      setError(null);
      setSavingStatus("saving");

      const templateName = current.name.trim() || "New Template";
      const createdTemplate = await createMobileTemplate(
        getToken,
        templateName,
      );

      const payload = buildTemplatePayload({
        ...current,
        id: createdTemplate.id,
        exercises: sortTemplateExercises(current.exercises ?? []).map(
          (exercise) => ({
            ...exercise,
            template_id: createdTemplate.id,
          }),
        ),
      });

      const savedTemplate = await overwriteMobileTemplateFromWorkout(
        getToken,
        createdTemplate.id,
        payload,
      );

      const savedExercises =
        savedTemplate.exercises && savedTemplate.exercises.length > 0
          ? savedTemplate.exercises
          : (current.exercises ?? []);

      const finalizedTemplate: MobileWorkoutTemplate = {
        ...createdTemplate,
        ...savedTemplate,
        id: createdTemplate.id,
        name: savedTemplate.name || templateName,
        in_plan: savedTemplate.in_plan ?? createdTemplate.in_plan ?? false,
        plan_order:
          savedTemplate.plan_order ?? createdTemplate.plan_order ?? null,
        exercises: sortTemplateExercises(
          savedExercises.map((exercise) => ({
            ...exercise,
            template_id: createdTemplate.id,
          })),
        ),
        exercise_count:
          savedTemplate.exercise_count ??
          savedTemplate.exercises?.length ??
          current.exercises?.length ??
          0,
        lastSetsByExercise:
          savedTemplate.lastSetsByExercise ?? current.lastSetsByExercise ?? {},
      };

      const cached = normalizeTemplatesResponse(getCachedTemplates());

      const nextTemplates = [
        finalizedTemplate,
        ...cached.templates.filter(
          (item) => item.id !== finalizedTemplate.id && item.id !== current.id,
        ),
      ];

      const nextTemplate =
        cached.plan.nextTemplate?.id === finalizedTemplate.id ||
        cached.plan.nextTemplate?.id === current.id
          ? finalizedTemplate
          : cached.plan.nextTemplate;

      setCachedTemplates({
        ...cached,
        templates: nextTemplates,
        plan: {
          ...cached.plan,
          nextTemplate,
        },
      });

      deleteDraftTemplate(current.id);

      hasUnsavedChangesRef.current = false;
      templateRef.current = finalizedTemplate;
      setTemplate(finalizedTemplate);
      setSavingStatus("saved");

      router.replace("/(tabs)/workouts");
    } catch (err) {
      console.warn("Failed to save draft template", err);
      setSavingStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save template");
    }
  }

  function startTemplateWorkout() {
    const current = templateRef.current;
    if (!current || starting || isDraftTemplateId(current.id)) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const draftWorkout = buildDraftWorkoutFromTemplate({
      template: current,
      startedFromQueuedTemplate: false,
    });

    triggerMediumHaptic();
    setStarting(true);
    setCachedActiveWorkout(draftWorkout);

    router.push({
      pathname: "/workout/[id]",
      params: {
        id: draftWorkout.workout.id,
      },
    });

    saveTemplateNowRef
      .current?.()
      .catch((err: unknown) => {
        console.warn(
          "Failed to save template before server workout start",
          err,
        );
      })
      .then(() => startMobileWorkout(getToken, current.id))
      .then((realWorkout) => {
        setCachedActiveWorkoutForId(draftWorkout.workout.id, realWorkout);
        setCachedActiveWorkout(realWorkout);
      })
      .catch((err: unknown) => {
        console.warn("Failed to start workout in background", err);
      })
      .finally(() => {
        setStarting(false);
      });
  }

  if (loading && !template) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading template...</Text>
      </SafeAreaView>
    );
  }

  if (error && !template) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <Text style={styles.errorTitle}>Couldn’t load template</Text>
        <Text selectable style={styles.errorText}>
          {error}
        </Text>

        <FitCard accent onPress={loadTemplate}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </FitCard>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.topTitle}>
              {isDraftTemplate ? "New Template" : "Edit Template"}
            </Text>
            <Text style={styles.savingText}>
              {savingStatus === "saving"
                ? isDraftTemplate
                  ? "Creating..."
                  : "Saving..."
                : savingStatus === "saved"
                  ? "Saved"
                  : savingStatus === "draft"
                    ? "Draft"
                    : savingStatus === "error"
                      ? "Save failed"
                      : "Ready"}
            </Text>
          </View>

          {isDraftTemplate ? (
            <Pressable
              onPress={saveDraftTemplate}
              disabled={!template || savingStatus === "saving"}
              style={[
                styles.topSaveButton,
                (!template || savingStatus === "saving") &&
                  styles.disabledButton,
              ]}
            >
              {savingStatus === "saving" ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.topSaveButtonText}>Save</Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            onPress={startTemplateWorkout}
            disabled={!template || starting || isDraftTemplate}
            style={[
              styles.topStartButton,
              (!template || starting || isDraftTemplate) &&
                styles.disabledButton,
            ]}
          >
            {starting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Ionicons name="play" size={18} color={colors.background} />
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <FitCard>
              <Text selectable style={styles.inlineError}>
                {error}
              </Text>
            </FitCard>
          ) : null}

          <TextInput
            value={template?.name ?? ""}
            onChangeText={updateTemplateName}
            placeholder="Template name"
            placeholderTextColor={colors.textFaint}
            style={styles.nameInput}
          />

          <FitCard accent>
            <Text style={styles.heroLabel}>Template setup</Text>
            <Text style={styles.heroTitle}>
              {formatExerciseCount(exerciseCount)}
            </Text>
            <Text style={styles.heroText}>
              Edit defaults here. Starting a workout uses these values
              instantly.
            </Text>

            {isDraftTemplate ? (
              <Pressable
                onPress={saveDraftTemplate}
                disabled={!template || savingStatus === "saving"}
                style={[
                  styles.startButton,
                  (!template || savingStatus === "saving") &&
                    styles.disabledButton,
                ]}
              >
                {savingStatus === "saving" ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.background}
                    />
                    <Text style={styles.startButtonText}>Save Template</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={startTemplateWorkout}
                disabled={!template || starting}
                style={[
                  styles.startButton,
                  (!template || starting) && styles.disabledButton,
                ]}
              >
                {starting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <Ionicons name="play" size={20} color={colors.background} />
                    <Text style={styles.startButtonText}>Start Workout</Text>
                  </>
                )}
              </Pressable>
            )}
          </FitCard>

          <View style={styles.exerciseList}>
            {exercises.map((exercise, index) => (
              <TemplateExerciseCard
                key={`${exercise.id}-${index}`}
                exercise={exercise}
                isFirst={index === 0}
                isLast={index === exercises.length - 1}
                onMoveUp={() => moveExercise(exercise.id, -1)}
                onMoveDown={() => moveExercise(exercise.id, 1)}
                onRemove={() => removeExercise(exercise.id)}
                onUpdateInteger={(field, value) =>
                  updateExerciseIntegerField(exercise.id, field, value)
                }
                onUpdateDecimal={(field, value) =>
                  updateExerciseDecimalField(exercise.id, field, value)
                }
              />
            ))}
          </View>

          <Pressable
            onPress={() => setShowExerciseSearch(true)}
            style={({ pressed }) => [
              styles.addExerciseButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons name="add" size={20} color={colors.teal} />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <ExerciseSearchModal
        visible={showExerciseSearch}
        query={exerciseQuery}
        searching={searchingExercises}
        results={exerciseResults}
        onChangeQuery={handleExerciseSearchInput}
        onClose={() => {
          if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
            searchTimerRef.current = null;
          }

          setShowExerciseSearch(false);
          setExerciseQuery("");
          setExerciseResults([]);
          setSearchingExercises(false);
        }}
        onSelect={addExercise}
      />
    </SafeAreaView>
  );
}

function TemplateExerciseCard({
  exercise,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdateInteger,
  onUpdateDecimal,
}: {
  exercise: MobileTemplateExercise;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onUpdateInteger: (
    field: "default_sets" | "default_reps",
    value: string,
  ) => void;
  onUpdateDecimal: (
    field:
      | "default_weight_kg"
      | "default_duration_minutes"
      | "default_speed"
      | "default_distance"
      | "default_incline",
    value: string,
  ) => void;
}) {
  const cardio = isCardioTemplateExercise(exercise);

  return (
    <FitCard style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseTitleBlock}>
          <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
          <Text style={styles.exerciseMuscle}>
            {cardio ? "cardio" : exercise.muscle_group || "other"}
          </Text>
        </View>

        <View style={styles.exerciseActions}>
          <Pressable
            onPress={onMoveUp}
            disabled={isFirst}
            style={[styles.iconButton, isFirst && styles.disabledIconButton]}
          >
            <Ionicons name="chevron-up" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={onMoveDown}
            disabled={isLast}
            style={[styles.iconButton, isLast && styles.disabledIconButton]}
          >
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable onPress={onRemove} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={16} color={colors.red} />
          </Pressable>
        </View>
      </View>

      {cardio ? (
        <View style={styles.fieldsGrid}>
          <TemplateNumberInput
            label="Entries"
            value={String(exercise.default_sets ?? 1)}
            onChange={(value) => onUpdateInteger("default_sets", value)}
          />

          <TemplateNumberInput
            label="Speed"
            value={
              exercise.default_speed === null ||
              exercise.default_speed === undefined
                ? ""
                : String(exercise.default_speed)
            }
            decimal
            onChange={(value) => onUpdateDecimal("default_speed", value)}
          />

          <TemplateNumberInput
            label="Time"
            value={
              exercise.default_duration_minutes === null ||
              exercise.default_duration_minutes === undefined
                ? ""
                : String(exercise.default_duration_minutes)
            }
            suffix="min"
            decimal
            onChange={(value) =>
              onUpdateDecimal("default_duration_minutes", value)
            }
          />

          <TemplateNumberInput
            label="Distance"
            value={
              exercise.default_distance === null ||
              exercise.default_distance === undefined
                ? ""
                : String(exercise.default_distance)
            }
            suffix="km"
            decimal
            onChange={(value) => onUpdateDecimal("default_distance", value)}
          />

          <TemplateNumberInput
            label="Incline"
            value={
              exercise.default_incline === null ||
              exercise.default_incline === undefined
                ? ""
                : String(exercise.default_incline)
            }
            suffix="%"
            decimal
            onChange={(value) => onUpdateDecimal("default_incline", value)}
          />
        </View>
      ) : (
        <View style={styles.fieldsGrid}>
          <TemplateNumberInput
            label="Sets"
            value={String(exercise.default_sets ?? 3)}
            onChange={(value) => onUpdateInteger("default_sets", value)}
          />

          <TemplateNumberInput
            label="Reps"
            value={String(exercise.default_reps ?? 8)}
            onChange={(value) => onUpdateInteger("default_reps", value)}
          />

          <TemplateNumberInput
            label="Weight"
            value={
              exercise.default_weight_kg === null ||
              exercise.default_weight_kg === undefined
                ? ""
                : String(exercise.default_weight_kg)
            }
            suffix="kg"
            decimal
            onChange={(value) => onUpdateDecimal("default_weight_kg", value)}
          />
        </View>
      )}
    </FitCard>
  );
}

function TemplateNumberInput({
  label,
  value,
  suffix,
  decimal,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  decimal?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputValueRow}>
        <TextInput
          value={value === "0" && decimal ? "" : value}
          onChangeText={onChange}
          keyboardType={
            decimal && Platform.OS === "ios" ? "decimal-pad" : "numeric"
          }
          selectTextOnFocus
          style={styles.input}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function ExerciseSearchModal({
  visible,
  query,
  searching,
  results,
  onChangeQuery,
  onClose,
  onSelect,
}: {
  visible: boolean;
  query: string;
  searching: boolean;
  results: MobileExerciseSearchResult[];
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onSelect: (exercise: MobileExerciseSearchResult) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.searchBackdrop}>
        <View style={styles.searchCard}>
          <View style={styles.searchHeader}>
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textFaint}
              autoFocus
              style={styles.searchInput}
            />

            <Pressable onPress={onClose} style={styles.searchCancelButton}>
              <Text style={styles.searchCancelText}>Cancel</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {searching ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator color={colors.teal} />
                <Text style={styles.searchLoadingText}>Searching...</Text>
              </View>
            ) : null}

            {!searching && query.trim().length >= 2 && results.length === 0 ? (
              <Text style={styles.noResultsText}>No exercises found</Text>
            ) : null}

            {results.map((exercise, index) => (
              <Pressable
                key={`${exercise.id}-${exercise.name}-${index}`}
                onPress={() => onSelect(exercise)}
                style={styles.searchResultRow}
              >
                <View>
                  <Text style={styles.searchResultName}>{exercise.name}</Text>
                  <Text style={styles.searchResultMeta}>
                    {exercise.target || exercise.muscle_group || "other"}
                    {exercise.bodyPart ? ` · ${exercise.bodyPart}` : ""}
                  </Text>
                </View>

                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color={colors.teal}
                />
              </Pressable>
            ))}
          </ScrollView>
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
  inlineError: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
  },
  topBar: {
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
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
  topTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  savingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  topStartButton: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  topSaveButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  topSaveButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 130,
    gap: spacing.md,
  },
  nameInput: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    paddingVertical: 4,
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
    fontSize: 28,
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
  startButton: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  exerciseList: {
    gap: spacing.md,
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
  exerciseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledIconButton: {
    opacity: 0.3,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.red,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  inputBox: {
    minWidth: "31%",
    flexGrow: 1,
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  inputValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    padding: 0,
  },
  inputSuffix: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 3,
  },
  addExerciseButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addExerciseText: {
    color: colors.teal,
    fontSize: 15,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  searchBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "android" ? 42 : 64,
    paddingBottom: spacing.lg,
  },
  searchCard: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "82%",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontWeight: "700",
  },
  searchCancelButton: {
    minHeight: 46,
    justifyContent: "center",
  },
  searchCancelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  searchLoading: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  searchLoadingText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  noResultsText: {
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.xl,
    fontSize: 14,
    fontWeight: "700",
  },
  searchResultRow: {
    minHeight: 62,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  searchResultName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  searchResultMeta: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
    textTransform: "capitalize",
  },
});