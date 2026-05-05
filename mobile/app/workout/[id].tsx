import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { router, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
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
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"
import {
  getCachedActiveWorkout,
  setCachedActiveWorkout,
  subscribeToCachedActiveWorkout,
} from "@/lib/activeWorkoutCache"
import { getMobileWorkout } from "@/lib/api"
import { getCachedTemplates, setCachedTemplates } from "@/lib/templatesCache"
import {
  MobileActiveWorkoutResponse,
  MobileExerciseSet,
  MobileWorkoutExercise,
} from "@/types/activeWorkout"
import { MobileWorkoutTemplate } from "@/types/workouts"

const API_BASE_URL = "https://myfitforge.vercel.app"

type ExerciseSearchResult = {
  id: string
  name: string
  bodyPart?: string
  target?: string
  muscle_group?: string
}

type RecapData = {
  exercises: number
  sets: number
  volume: number
  duration: number
}

type EditingSetState = {
  exerciseId: string
  exerciseName: string
  setId: string
  setNumber: number
  reps: number | ""
  weight_kg: number | string | ""
} | null

type SaveTimerMap = Record<string, ReturnType<typeof setTimeout>>

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

function makeTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0")
  const seconds = (totalSeconds % 60).toString().padStart(2, "0")

  return `${minutes}:${seconds}`
}

function getSetNumberValue(value: number | string | "") {
  if (value === "") return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function calculateVolume(exercises: MobileWorkoutExercise[]) {
  return exercises.reduce((total, exercise) => {
    return (
      total +
      exercise.sets.reduce((setTotal, set) => {
        return (
          setTotal +
          getSetNumberValue(set.weight_kg) * getSetNumberValue(set.reps)
        )
      }, 0)
    )
  }, 0)
}

function getReadableError(err: unknown) {
  if (err instanceof Error) return err.message
  return "Something went wrong"
}

function cloneWorkout(workout: MobileActiveWorkoutResponse) {
  return {
    ...workout,
    workout: {
      ...workout.workout,
    },
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set })),
      last_session: exercise.last_session
        ? exercise.last_session.map((set) => ({ ...set }))
        : undefined,
    })),
  }
}

function mergeRealWorkoutWithLocalState({
  local,
  real,
}: {
  local: MobileActiveWorkoutResponse
  real: MobileActiveWorkoutResponse
}) {
  const realExercisesByOrder = [...real.exercises].sort(
    (a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0)
  )

  return {
    ...local,
    isDraft: false,
    workout: {
      ...local.workout,
      id: real.workout.id,
      user_id: real.workout.user_id,
      performed_at: real.workout.performed_at,
      isTemp: false,
    },
    exercises: local.exercises.map((localExercise, localIndex) => {
      const matchingRealExercise = realExercisesByOrder[localIndex]

      if (!matchingRealExercise) {
        return localExercise
      }

      const realSetsByNumber = [...matchingRealExercise.sets].sort(
        (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
      )

      return {
        ...localExercise,
        id: matchingRealExercise.id,
        workout_id: real.workout.id,
        exercise_external_id: matchingRealExercise.exercise_external_id,
        isTemp: false,
        sets: localExercise.sets.map((localSet, localSetIndex) => {
          const matchingRealSet =
            realSetsByNumber.find(
              (realSet) => realSet.set_number === localSet.set_number
            ) ?? realSetsByNumber[localSetIndex]

          if (!matchingRealSet) {
            return {
              ...localSet,
              workout_exercise_id: matchingRealExercise.id,
            }
          }

          return {
            ...localSet,
            id: matchingRealSet.id,
            workout_exercise_id: matchingRealExercise.id,
            isTemp: false,
          }
        }),
      }
    }),
    startedFromTemplateId: local.startedFromTemplateId ?? real.startedFromTemplateId,
    startedFromQueuedTemplate:
      local.startedFromQueuedTemplate ?? real.startedFromQueuedTemplate,
  }
}

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()

  const [data, setData] = useState<MobileActiveWorkoutResponse | null>(() => {
    if (!id) return null
    return getCachedActiveWorkout(id)
  })

  const [workoutName, setWorkoutName] = useState("")
  const [loading, setLoading] = useState(!data)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [elapsed, setElapsed] = useState(0)
  const [restDuration, setRestDuration] = useState(60)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [showRestPicker, setShowRestPicker] = useState(false)

  const [showExerciseSearch, setShowExerciseSearch] = useState(false)
  const [exerciseQuery, setExerciseQuery] = useState("")
  const [exerciseResults, setExerciseResults] = useState<ExerciseSearchResult[]>([])
  const [searchingExercises, setSearchingExercises] = useState(false)

  const [showRecap, setShowRecap] = useState(false)
  const [editingSet, setEditingSet] = useState<EditingSetState>(null)
  const [recapData, setRecapData] = useState<RecapData | null>(null)
  const [templateUpdateStatus, setTemplateUpdateStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle")
  const [finishing, setFinishing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const startTimeRef = useRef(Date.now())
  const saveTimersRef = useRef<SaveTimerMap>({})
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestDataRef = useRef<MobileActiveWorkoutResponse | null>(data)

  useEffect(() => {
    latestDataRef.current = data
  }, [data])

  useEffect(() => {
    if (data?.workout.name) {
      setWorkoutName(data.workout.name)
    }
  }, [data?.workout.name])

  const apiRequest = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const token = await getToken()

      if (!token) {
        throw new Error("No Clerk session token found. Please sign in again.")
      }

      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(options?.headers ?? {}),
        },
      })

      const text = await res.text().catch(() => "")

      if (!res.ok) {
        throw new Error(text || `Request failed: ${res.status}`)
      }

      if (!text) return {} as T

      try {
        return JSON.parse(text) as T
      } catch {
        return text as T
      }
    },
    [getToken]
  )

  const saveSetNow = useCallback(
    async (set: MobileExerciseSet) => {
      if (
        set.isTemp ||
        set.id.startsWith("draft") ||
        set.id.startsWith("temp")
      ) {
        return
      }

      await apiRequest(`/api/exercise-sets/${set.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          reps: getSetNumberValue(set.reps),
          weight_kg: getSetNumberValue(set.weight_kg),
        }),
      })
    },
    [apiRequest]
  )

  const flushSaves = useCallback(async () => {
    Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer))
    saveTimersRef.current = {}

    const current = latestDataRef.current
    if (!current) return

    const savePromises = current.exercises.flatMap((exercise) =>
      exercise.sets
        .filter(
          (set) =>
            !set.isTemp &&
            !set.id.startsWith("draft") &&
            !set.id.startsWith("temp")
        )
        .map((set) =>
          saveSetNow(set).catch((err: unknown) => {
            console.warn("Failed to flush set save", err)
          })
        )
    )

    await Promise.all(savePromises)
  }, [saveSetNow])

  const loadWorkout = useCallback(
    async (isRefresh = false) => {
      if (!id) return

      if (id.startsWith("draft-workout")) {
        setLoading(false)
        return
      }

      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError(null)

        const workout = await getMobileWorkout(getToken, id)
        setData(workout)
        setCachedActiveWorkout(workout)
      } catch (err) {
        setError(getReadableError(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken, id]
  )

  useEffect(() => {
    if (!id) return

    return subscribeToCachedActiveWorkout(id, (workout) => {
      setData((current) => {
        if (!current) return workout

        const merged = mergeRealWorkoutWithLocalState({
          local: current,
          real: workout,
        })

        latestDataRef.current = merged

        setTimeout(() => {
          flushSaves().catch((err: unknown) => {
            console.warn("Failed to flush after real workout arrived", err)
          })
        }, 0)

        return merged
      })

      setLoading(false)
      setError(null)
    })
  }, [flushSaves, id])

  useEffect(() => {
    if (!id) return

    if (id.startsWith("draft-workout")) {
      setLoading(false)
      return
    }

    loadWorkout(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current)
      }

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }

      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const exercises = useMemo(() => {
    return Array.isArray(data?.exercises) ? data.exercises : []
  }, [data?.exercises])

  const totalVolume = useMemo(() => calculateVolume(exercises), [exercises])

  const totalSets = useMemo(() => {
    return exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  }, [exercises])

  const completedSets = useMemo(() => {
    return exercises.reduce(
      (sum, exercise) =>
        sum + exercise.sets.filter((set) => set.completed).length,
      0
    )
  }, [exercises])

  function updateWorkoutState(
    updater: (current: MobileActiveWorkoutResponse) => MobileActiveWorkoutResponse
  ) {
    setData((current) => {
      if (!current) return current

      const next = updater(cloneWorkout(current))
      latestDataRef.current = next

      if (id) {
        setCachedActiveWorkout(next)
      }

      return next
    })
  }

  function startRestTimer(seconds = restDuration) {
    setRestRemaining(seconds)

    if (restTimerRef.current) {
      clearInterval(restTimerRef.current)
    }

    restTimerRef.current = setInterval(() => {
      setRestRemaining((current) => {
        if (current === null || current <= 1) {
          if (restTimerRef.current) {
            clearInterval(restTimerRef.current)
          }

          return null
        }

        return current - 1
      })
    }, 1000)
  }

  function cancelRestTimer() {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current)
    }

    setRestRemaining(null)
  }

  function toggleSetComplete(exerciseId: string, setId: string) {
    triggerMediumHaptic()

    updateWorkoutState((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId
                  ? {
                      ...set,
                      completed: !set.completed,
                    }
                  : set
              ),
            }
          : exercise
      ),
    }))

    startRestTimer()
  }

  function openSetEditor({
    exercise,
    set,
  }: {
    exercise: MobileWorkoutExercise
    set: MobileExerciseSet
  }) {
    triggerLightHaptic()

    setEditingSet({
      exerciseId: exercise.id,
      exerciseName: exercise.exercise_name,
      setId: set.id,
      setNumber: set.set_number,
      reps: set.reps,
      weight_kg: set.weight_kg,
    })
  }

  function closeSetEditor() {
    setEditingSet(null)
  }

  function updateEditingSetValue(field: "reps" | "weight_kg", value: string) {
    setEditingSet((current) => {
      if (!current) return current

      const parsedValue = value === "" ? "" : Number(value)

      updateSetValue({
        exerciseId: current.exerciseId,
        setId: current.setId,
        field,
        value,
      })

      return {
        ...current,
        [field]: parsedValue,
      }
    })
  }

  function adjustEditingSetValue(field: "reps" | "weight_kg", direction: -1 | 1) {
    setEditingSet((current) => {
      if (!current) return current

      const currentValue = getSetNumberValue(current[field])
      const step = field === "weight_kg" ? 2.5 : 1
      const nextValue = Math.max(0, currentValue + direction * step)

      triggerLightHaptic()

      updateSetValue({
        exerciseId: current.exerciseId,
        setId: current.setId,
        field,
        value: String(nextValue),
      })

      return {
        ...current,
        [field]: nextValue,
      }
    })
  }

  function queueSetSave(set: MobileExerciseSet) {
    const saveKey = set.id

    if (saveTimersRef.current[saveKey]) {
      clearTimeout(saveTimersRef.current[saveKey])
    }

    saveTimersRef.current[saveKey] = setTimeout(() => {
      saveSetNow(set).catch((err: unknown) => {
        console.warn("Failed to save set", err)
      })

      delete saveTimersRef.current[saveKey]
    }, 800)
  }

  function updateSetValue({
    exerciseId,
    setId,
    field,
    value,
  }: {
    exerciseId: string
    setId: string
    field: "reps" | "weight_kg"
    value: string
  }) {
    let updatedSet: MobileExerciseSet | null = null

    updateWorkoutState((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => {
                if (set.id !== setId) return set

                updatedSet = {
                  ...set,
                  [field]: value === "" ? "" : Number(value),
                }

                return updatedSet
              }),
            }
          : exercise
      ),
    }))

    if (updatedSet) {
      queueSetSave(updatedSet)
    }
  }

  function addSet(exerciseId: string) {
    triggerLightHaptic()

    const targetExercise = exercises.find((exercise) => exercise.id === exerciseId)
    if (!targetExercise) return

    const previousSet = targetExercise.sets[targetExercise.sets.length - 1]
    const newSetNumber = targetExercise.sets.length + 1
    const tempSetId = makeTempId("temp-set")

    const optimisticSet: MobileExerciseSet = {
      id: tempSetId,
      workout_exercise_id: exerciseId,
      set_number: newSetNumber,
      reps: previousSet?.reps ?? 8,
      weight_kg: previousSet?.weight_kg ?? 0,
      completed: false,
      isTemp: true,
    }

    updateWorkoutState((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets, optimisticSet],
            }
          : exercise
      ),
    }))

    if (targetExercise.isTemp || exerciseId.startsWith("draft")) {
      return
    }

    apiRequest<MobileExerciseSet>("/api/exercise-sets", {
      method: "POST",
      body: JSON.stringify({
        workout_exercise_id: exerciseId,
        set_number: newSetNumber,
        reps: getSetNumberValue(optimisticSet.reps),
        weight_kg: getSetNumberValue(optimisticSet.weight_kg),
      }),
    })
      .then((createdSet) => {
        updateWorkoutState((current) => ({
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  sets: exercise.sets.map((set) =>
                    set.id === tempSetId
                      ? {
                          ...createdSet,
                          completed: set.completed,
                          isTemp: false,
                        }
                      : set
                  ),
                }
              : exercise
          ),
        }))
      })
      .catch((err: unknown) => {
        console.warn("Failed to add set", err)
      })
  }

  function removeSet(exerciseId: string, setId: string) {
    triggerLightHaptic()

    const targetSet = exercises
      .find((exercise) => exercise.id === exerciseId)
      ?.sets.find((set) => set.id === setId)

    updateWorkoutState((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets
                .filter((set) => set.id !== setId)
                .map((set, index) => ({
                  ...set,
                  set_number: index + 1,
                })),
            }
          : exercise
      ),
    }))

    if (
      !targetSet ||
      targetSet.isTemp ||
      setId.startsWith("draft") ||
      setId.startsWith("temp")
    ) {
      return
    }

    apiRequest(`/api/exercise-sets/${setId}`, {
      method: "DELETE",
    }).catch((err: unknown) => {
      console.warn("Failed to remove set", err)
    })
  }

  function removeExercise(exerciseId: string) {
    triggerLightHaptic()

    const current = latestDataRef.current
    if (!current) return

    const targetExercise = current.exercises.find(
      (exercise) => exercise.id === exerciseId
    )

    if (!targetExercise) return

    updateWorkoutState((draft) => ({
      ...draft,
      exercises: draft.exercises
        .filter((exercise) => exercise.id !== exerciseId)
        .map((exercise, index) => ({
          ...exercise,
          order_index: index,
        })),
    }))

    if (
      targetExercise.isTemp ||
      exerciseId.startsWith("draft") ||
      exerciseId.startsWith("temp")
    ) {
      return
    }

    apiRequest(`/api/workout-exercises/${exerciseId}`, {
      method: "DELETE",
    }).catch((err: unknown) => {
      console.warn("Failed to remove exercise", err)
    })
  }

  function reorderExercise(exerciseId: string, direction: -1 | 1) {
    const current = latestDataRef.current
    if (!current) return

    const currentIndex = current.exercises.findIndex(
      (exercise) => exercise.id === exerciseId
    )
    const nextIndex = currentIndex + direction

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= current.exercises.length
    ) {
      return
    }

    triggerLightHaptic()

    const reordered = [...current.exercises]
    const [movedExercise] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, movedExercise)

    const reorderedWithIndex = reordered.map((exercise, index) => ({
      ...exercise,
      order_index: index,
    }))

    updateWorkoutState((draft) => ({
      ...draft,
      exercises: reorderedWithIndex,
    }))

    Promise.all(
      reorderedWithIndex
        .filter(
          (exercise) =>
            !exercise.isTemp &&
            !exercise.id.startsWith("draft") &&
            !exercise.id.startsWith("temp")
        )
        .map((exercise, index) =>
          apiRequest(`/api/workout-exercises/${exercise.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              order_index: index,
            }),
          }).catch((err: unknown) => {
            console.warn("Failed to save exercise order", err)
          })
        )
    ).catch((err: unknown) => {
      console.warn("Failed to reorder exercises", err)
    })
  }

  function handleExerciseSearchInput(value: string) {
    setExerciseQuery(value)

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }

    if (value.trim().length < 2) {
      setExerciseResults([])
      return
    }

    searchTimerRef.current = setTimeout(() => {
      setSearchingExercises(true)

      apiRequest<ExerciseSearchResult[]>(
        `/api/exercises/search?q=${encodeURIComponent(value.trim())}`
      )
        .then((results) => {
          setExerciseResults(Array.isArray(results) ? results : [])
        })
        .catch((err: unknown) => {
          console.warn("Failed to search exercises", err)
          setExerciseResults([])
        })
        .finally(() => {
          setSearchingExercises(false)
        })
    }, 350)
  }

  function addExercise(result: ExerciseSearchResult) {
    const current = latestDataRef.current
    if (!current) return

    triggerMediumHaptic()

    const workoutId = current.workout.id
    const tempExerciseId = makeTempId("temp-exercise")
    const muscleGroup = result.target || result.muscle_group || result.bodyPart || "other"

    const optimisticExercise: MobileWorkoutExercise = {
      id: tempExerciseId,
      workout_id: workoutId,
      exercise_name: result.name,
      exercise_external_id: result.id ?? null,
      muscle_group: muscleGroup,
      order_index: current.exercises.length,
      isTemp: true,
      last_session: [],
      sets: [],
    }

    updateWorkoutState((draft) => ({
      ...draft,
      exercises: [...draft.exercises, optimisticExercise],
    }))

    setShowExerciseSearch(false)
    setExerciseQuery("")
    setExerciseResults([])

    if (current.workout.isTemp || workoutId.startsWith("draft")) {
      return
    }

    apiRequest<MobileWorkoutExercise>("/api/workout-exercises", {
      method: "POST",
      body: JSON.stringify({
        workout_id: workoutId,
        exercise_name: result.name,
        exercise_external_id: result.id ?? null,
        muscle_group: muscleGroup,
        order_index: current.exercises.length,
      }),
    })
      .then((createdExercise) => {
        updateWorkoutState((draft) => ({
          ...draft,
          exercises: draft.exercises.map((exercise) =>
            exercise.id === tempExerciseId
              ? {
                  ...createdExercise,
                  sets: [],
                  last_session: [],
                  isTemp: false,
                }
              : exercise
          ),
        }))
      })
      .catch((err: unknown) => {
        console.warn("Failed to add exercise", err)
      })
  }

  function buildTemplateOverwriteExercises(current: MobileActiveWorkoutResponse) {
    return current.exercises.map((exercise, exerciseIndex) => {
      const sortedSets = [...exercise.sets].sort(
        (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
      )

      const lastSet = sortedSets[sortedSets.length - 1]

      return {
        exercise_name: exercise.exercise_name,
        muscle_group: exercise.muscle_group ?? "other",
        order_index: exerciseIndex,
        default_sets: Math.max(1, sortedSets.length),
        default_reps: Math.max(0, getSetNumberValue(lastSet?.reps ?? 0)),
        default_weight_kg: Math.max(
          0,
          getSetNumberValue(lastSet?.weight_kg ?? 0)
        ),
      }
    })
  }

  async function updateTemplateFromWorkout() {
    const current = latestDataRef.current
    const templateId = current?.startedFromTemplateId

    if (!current || !templateId || templateUpdateStatus === "saving") {
      return
    }

    triggerMediumHaptic()
    setTemplateUpdateStatus("saving")

    const exercisesForTemplate = buildTemplateOverwriteExercises(current)

    try {
      const updatedTemplate = await apiRequest<MobileWorkoutTemplate>(
        `/api/mobile/templates/${templateId}/overwrite-from-workout`,
        {
          method: "POST",
          body: JSON.stringify({
            exercises: exercisesForTemplate,
          }),
        }
      )

      const cachedTemplates = getCachedTemplates()

      if (cachedTemplates) {
        const nextTemplates = cachedTemplates.templates.map((template) =>
          template.id === updatedTemplate.id
            ? {
                ...template,
                ...updatedTemplate,
                lastSetsByExercise: template.lastSetsByExercise ?? {},
              }
            : template
        )

        const nextTemplate =
          cachedTemplates.plan.nextTemplate?.id === updatedTemplate.id
            ? {
                ...cachedTemplates.plan.nextTemplate,
                ...updatedTemplate,
                lastSetsByExercise:
                  cachedTemplates.plan.nextTemplate.lastSetsByExercise ?? {},
              }
            : cachedTemplates.plan.nextTemplate

        setCachedTemplates({
          ...cachedTemplates,
          templates: nextTemplates,
          plan: {
            ...cachedTemplates.plan,
            nextTemplate,
          },
        })
      }

      setTemplateUpdateStatus("saved")
    } catch (err) {
      console.warn("Failed to update template from workout", err)
      setTemplateUpdateStatus("idle")
    }
  }

  async function cancelWorkout() {
    triggerMediumHaptic()
    setCancelling(true)

    const current = latestDataRef.current

    if (
      current &&
      !current.workout.isTemp &&
      !current.workout.id.startsWith("draft")
    ) {
      apiRequest(`/api/workouts/${current.workout.id}`, {
        method: "DELETE",
      }).catch((err: unknown) => {
        console.warn("Failed to delete workout while cancelling", err)
      })
    }

    router.back()
  }

  async function finishWorkout() {
    const current = latestDataRef.current
    if (!current || finishing) return

    triggerMediumHaptic()

    const durationMinutes = Math.max(1, Math.floor(elapsed / 60))
    const recap: RecapData = {
      exercises: current.exercises.length,
      sets: current.exercises.reduce(
        (sum, exercise) => sum + exercise.sets.length,
        0
      ),
      volume: calculateVolume(current.exercises),
      duration: durationMinutes,
    }

    setRecapData(recap)
    setTemplateUpdateStatus("idle")
    setShowRecap(true)
    setFinishing(false)

    flushSaves().catch((err: unknown) => {
      console.warn("Failed to flush saves on finish", err)
    })

    if (!current.workout.isTemp && !current.workout.id.startsWith("draft")) {
      apiRequest(`/api/workouts/${current.workout.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: workoutName,
          duration_minutes: durationMinutes,
        }),
      }).catch((err: unknown) => {
        console.warn("Failed to finish workout", err)
      })
    }

    if (current.startedFromQueuedTemplate && current.startedFromTemplateId) {
      apiRequest("/api/profile/advance-plan", {
        method: "POST",
        body: JSON.stringify({
          template_id: current.startedFromTemplateId,
        }),
      }).catch((err: unknown) => {
        console.warn("Failed to advance workout plan", err)
      })
    }
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
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={cancelWorkout}
            disabled={cancelling}
            style={({ pressed }) => [
              styles.topTextButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.cancelText}>
              {cancelling ? "Cancelling..." : "✕ Cancel"}
            </Text>
          </Pressable>

          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>

          <Pressable
            onPress={finishWorkout}
            disabled={finishing}
            style={({ pressed }) => [
              styles.finishTopButton,
              pressed ? styles.pressed : null,
              finishing ? styles.disabledButton : null,
            ]}
          >
            <Text style={styles.finishTopText}>
              {finishing ? "Saving..." : "Finish"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadWorkout(true)}
              tintColor={colors.teal}
            />
          }
        >
          {error ? (
            <FitCard>
              <Text selectable style={styles.inlineError}>
                {error}
              </Text>
            </FitCard>
          ) : null}

          <TextInput
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="Workout name"
            placeholderTextColor={colors.textFaint}
            style={styles.workoutNameInput}
          />

          <FitCard style={styles.restCard}>
            <View style={styles.restRow}>
              <View>
                <Text style={styles.restLabel}>Rest Timer</Text>
                {restRemaining !== null ? (
                  <Text style={styles.restTime}>{formatTime(restRemaining)}</Text>
                ) : (
                  <Text style={styles.restHint}>Complete a set to start</Text>
                )}
              </View>

              <View style={styles.restActions}>
                {restRemaining !== null ? (
                  <Pressable onPress={cancelRestTimer} style={styles.restCancel}>
                    <Text style={styles.restCancelText}>Cancel</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => setShowRestPicker((value) => !value)}
                  style={styles.restDurationButton}
                >
                  <Text style={styles.restDurationText}>
                    {formatTime(restDuration)}
                  </Text>
                </Pressable>
              </View>
            </View>

            {showRestPicker ? (
              <View style={styles.restPicker}>
                {[60, 90, 120, 180, 240, 300].map((seconds) => (
                  <Pressable
                    key={seconds}
                    onPress={() => {
                      setRestDuration(seconds)
                      setShowRestPicker(false)
                    }}
                    style={[
                      styles.restPickerButton,
                      restDuration === seconds
                        ? styles.restPickerButtonActive
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.restPickerText,
                        restDuration === seconds
                          ? styles.restPickerTextActive
                          : null,
                      ]}
                    >
                      {seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </FitCard>

          <View style={styles.exerciseList}>
            {exercises.map((exercise, index) => (
              <ExerciseCard
                key={`${exercise.id}-${exercise.order_index ?? index}-${index}`}
                exercise={exercise}
                isFirst={index === 0}
                isLast={index === exercises.length - 1}
                onOpenSetEditor={openSetEditor}
                onToggleSet={toggleSetComplete}
                onAddSet={addSet}
                onRemoveSet={removeSet}
                onRemoveExercise={removeExercise}
                onMoveUp={() => reorderExercise(exercise.id, -1)}
                onMoveDown={() => reorderExercise(exercise.id, 1)}
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

        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryLabel}>Total Volume</Text>
            <Text style={styles.summaryValue}>
              {Math.round(totalVolume).toLocaleString()} kg
            </Text>
          </View>

          <View style={styles.summaryCenter}>
            <Text style={styles.summaryLabel}>Sets Done</Text>
            <Text style={styles.summaryValue}>
              {completedSets}
              <Text style={styles.summaryMuted}>/{totalSets}</Text>
            </Text>
          </View>

          <View style={styles.summaryRight}>
            <Text style={styles.summaryLabel}>Exercises</Text>
            <Text style={styles.summaryValue}>{exercises.length}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ExerciseSearchModal
        visible={showExerciseSearch}
        query={exerciseQuery}
        searching={searchingExercises}
        results={exerciseResults}
        onChangeQuery={handleExerciseSearchInput}
        onClose={() => {
          setShowExerciseSearch(false)
          setExerciseQuery("")
          setExerciseResults([])
        }}
        onSelect={addExercise}
      />

      <SetEditorModal
        editingSet={editingSet}
        onClose={closeSetEditor}
        onAdjust={adjustEditingSetValue}
        onChange={updateEditingSetValue}
      />

      <RecapModal
        visible={showRecap}
        workoutName={workoutName}
        recap={recapData}
        canUpdateTemplate={Boolean(latestDataRef.current?.startedFromTemplateId)}
        templateUpdateStatus={templateUpdateStatus}
        onUpdateTemplate={updateTemplateFromWorkout}
        onClose={() => {
          setShowRecap(false)

          requestAnimationFrame(() => {
            router.replace("/(tabs)")
          })
        }}
      />
    </SafeAreaView>
  )
}

function ExerciseCard({
  exercise,
  isFirst,
  isLast,
  onOpenSetEditor,
  onToggleSet,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onMoveUp,
  onMoveDown,
}: {
  exercise: MobileWorkoutExercise
  isFirst: boolean
  isLast: boolean
  onOpenSetEditor: (args: {
    exercise: MobileWorkoutExercise
    set: MobileExerciseSet
  }) => void
  onToggleSet: (exerciseId: string, setId: string) => void
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string, setId: string) => void
  onRemoveExercise: (exerciseId: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <FitCard style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseTitleBlock}>
          <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
          <Text style={styles.exerciseMuscle}>
            {exercise.muscle_group || "other"}
          </Text>
        </View>

        <View style={styles.exerciseHeaderActions}>
          <Pressable
            onPress={onMoveUp}
            disabled={isFirst}
            style={[styles.exerciseMoveButton, isFirst && styles.disabledMoveButton]}
          >
            <Ionicons name="chevron-up" size={17} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={onMoveDown}
            disabled={isLast}
            style={[styles.exerciseMoveButton, isLast && styles.disabledMoveButton]}
          >
            <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => onRemoveExercise(exercise.id)}
            style={styles.removeExerciseButton}
          >
            <Text style={styles.removeExerciseText}>Remove</Text>
          </Pressable>
        </View>
      </View>

      {exercise.last_session && exercise.last_session.length > 0 ? (
        <View style={styles.lastSessionBox}>
          <Text style={styles.lastSessionTitle}>Last session:</Text>
          <View style={styles.lastSessionWrap}>
            {exercise.last_session.map((set, index) => (
              <Text
                key={`${exercise.id}-last-${set.set_number}-${index}`}
                style={styles.lastSessionText}
              >
                Set {set.set_number}: {set.weight_kg}kg × {set.reps}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {exercise.sets.length > 0 ? (
        <View style={styles.compactSetHeader}>
          <Text style={styles.compactSetHeaderSet}>Set</Text>
          <Text style={styles.compactSetHeaderMain}>Weight × Reps</Text>
          <Text style={styles.compactSetHeaderDone}>Done</Text>
        </View>
      ) : null}

      <View style={styles.setList}>
        {exercise.sets.map((set, index) => (
          <SetRow
            key={`${set.id}-${set.set_number}-${index}`}
            exercise={exercise}
            set={set}
            onOpenSetEditor={onOpenSetEditor}
            onToggleSet={onToggleSet}
            onRemoveSet={onRemoveSet}
          />
        ))}
      </View>

      <Pressable
        onPress={() => onAddSet(exercise.id)}
        style={({ pressed }) => [
          styles.addSetButton,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.addSetText}>+ Add Set</Text>
      </Pressable>
    </FitCard>
  )
}

function SetRow({
  exercise,
  set,
  onOpenSetEditor,
  onToggleSet,
  onRemoveSet,
}: {
  exercise: MobileWorkoutExercise
  set: MobileExerciseSet
  onOpenSetEditor: (args: {
    exercise: MobileWorkoutExercise
    set: MobileExerciseSet
  }) => void
  onToggleSet: (exerciseId: string, setId: string) => void
  onRemoveSet: (exerciseId: string, setId: string) => void
}) {
  return (
    <View style={[styles.compactSetRow, set.completed ? styles.setRowComplete : null]}>
      <Text
        style={[
          styles.compactSetNumber,
          set.completed ? styles.setNumberCompleteText : null,
        ]}
      >
        {set.set_number}
      </Text>

      <Pressable
        onPress={() => onOpenSetEditor({ exercise, set })}
        style={({ pressed }) => [
          styles.compactSetValueButton,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.compactSetValue}>
          {getSetNumberValue(set.weight_kg)}kg × {getSetNumberValue(set.reps)}
        </Text>
        <Text style={styles.compactSetHint}>Tap to edit</Text>
      </Pressable>

      <View style={styles.compactSetActions}>
        <Pressable
          onPress={() => onToggleSet(exercise.id, set.id)}
          style={[
            styles.completeSetButton,
            set.completed ? styles.completeSetButtonActive : null,
          ]}
        >
          <Ionicons
            name="checkmark"
            size={16}
            color={set.completed ? colors.background : colors.textMuted}
          />
        </Pressable>

        <Pressable
          onPress={() => onRemoveSet(exercise.id, set.id)}
          style={styles.removeSetButton}
        >
          <Ionicons name="close" size={15} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  )
}

function SetEditorModal({
  editingSet,
  onClose,
  onAdjust,
  onChange,
}: {
  editingSet: EditingSetState
  onClose: () => void
  onAdjust: (field: "reps" | "weight_kg", direction: -1 | 1) => void
  onChange: (field: "reps" | "weight_kg", value: string) => void
}) {
  return (
    <Modal
      visible={Boolean(editingSet)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.setEditorBackdrop}>
        <View style={styles.setEditorCard}>
          <Text style={styles.setEditorExercise}>
            {editingSet?.exerciseName}
          </Text>
          <Text style={styles.setEditorTitle}>Set {editingSet?.setNumber}</Text>

          <View style={styles.setEditorSection}>
            <Text style={styles.setEditorLabel}>Weight</Text>

            <View style={styles.setEditorControlRow}>
              <Pressable
                onPress={() => onAdjust("weight_kg", -1)}
                style={styles.setEditorBigButton}
              >
                <Text style={styles.setEditorBigButtonText}>−</Text>
              </Pressable>

              <View style={styles.setEditorValueBox}>
                <TextInput
                  value={String(editingSet?.weight_kg ?? "")}
                  onChangeText={(value) => onChange("weight_kg", value)}
                  keyboardType="numeric"
                  selectTextOnFocus
                  style={styles.setEditorInput}
                />
                <Text style={styles.setEditorUnit}>kg</Text>
              </View>

              <Pressable
                onPress={() => onAdjust("weight_kg", 1)}
                style={styles.setEditorBigButton}
              >
                <Text style={styles.setEditorBigButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.setEditorSection}>
            <Text style={styles.setEditorLabel}>Reps</Text>

            <View style={styles.setEditorControlRow}>
              <Pressable
                onPress={() => onAdjust("reps", -1)}
                style={styles.setEditorBigButton}
              >
                <Text style={styles.setEditorBigButtonText}>−</Text>
              </Pressable>

              <View style={styles.setEditorValueBox}>
                <TextInput
                  value={String(editingSet?.reps ?? "")}
                  onChangeText={(value) => onChange("reps", value)}
                  keyboardType="numeric"
                  selectTextOnFocus
                  style={styles.setEditorInput}
                />
                <Text style={styles.setEditorUnit}>reps</Text>
              </View>

              <Pressable
                onPress={() => onAdjust("reps", 1)}
                style={styles.setEditorBigButton}
              >
                <Text style={styles.setEditorBigButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Pressable onPress={onClose} style={styles.setEditorDoneButton}>
            <Text style={styles.setEditorDoneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
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
  visible: boolean
  query: string
  searching: boolean
  results: ExerciseSearchResult[]
  onChangeQuery: (value: string) => void
  onClose: () => void
  onSelect: (exercise: ExerciseSearchResult) => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
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

            {!searching && query.length >= 2 && results.length === 0 ? (
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
  )
}

function RecapModal({
  visible,
  workoutName,
  recap,
  canUpdateTemplate,
  templateUpdateStatus,
  onUpdateTemplate,
  onClose,
}: {
  visible: boolean
  workoutName: string
  recap: RecapData | null
  canUpdateTemplate: boolean
  templateUpdateStatus: "idle" | "saving" | "saved"
  onUpdateTemplate: () => void
  onClose: () => void
}) {
  const updateLabel =
    templateUpdateStatus === "saving"
      ? "Updating..."
      : templateUpdateStatus === "saved"
        ? "Template Updated"
        : "Update Template"

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.recapBackdrop}>
        <View style={styles.recapCard}>
          <Text style={styles.recapEmoji}>💪</Text>
          <Text style={styles.recapTitle}>Workout Complete!</Text>
          <Text style={styles.recapWorkoutName}>{workoutName}</Text>

          <View style={styles.recapGrid}>
            <View style={styles.recapTile}>
              <Text style={styles.recapValue}>{recap?.exercises ?? 0}</Text>
              <Text style={styles.recapLabel}>Exercises</Text>
            </View>

            <View style={styles.recapTile}>
              <Text style={styles.recapValue}>{recap?.sets ?? 0}</Text>
              <Text style={styles.recapLabel}>Sets</Text>
            </View>

            <View style={styles.recapTile}>
              <Text style={styles.recapValue}>
                {Math.round(recap?.volume ?? 0).toLocaleString()}
              </Text>
              <Text style={styles.recapLabel}>kg Volume</Text>
            </View>

            <View style={styles.recapTile}>
              <Text style={styles.recapValue}>{recap?.duration ?? 0}</Text>
              <Text style={styles.recapLabel}>Minutes</Text>
            </View>
          </View>

          {canUpdateTemplate ? (
            <View style={styles.templateUpdateBox}>
              <Text style={styles.templateUpdateTitle}>Update template?</Text>
              <Text style={styles.templateUpdateText}>
                Save this workout’s exercises, order, set count, reps, and
                weights as the new template defaults for next time.
              </Text>

              <Pressable
                onPress={onUpdateTemplate}
                disabled={
                  templateUpdateStatus === "saving" ||
                  templateUpdateStatus === "saved"
                }
                style={[
                  styles.templateUpdateButton,
                  templateUpdateStatus === "saved"
                    ? styles.templateUpdateButtonSaved
                    : null,
                ]}
              >
                <Text style={styles.templateUpdateButtonText}>
                  {updateLabel}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable onPress={onClose} style={styles.recapButton}>
            <Text style={styles.recapButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    lineHeight: 18,
  },
  topBar: {
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTextButton: {
    minWidth: 80,
    minHeight: 36,
    justifyContent: "center",
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  timerText: {
    color: colors.teal,
    fontSize: 20,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  finishTopButton: {
    minWidth: 80,
    minHeight: 36,
    borderRadius: radius.md,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  finishTopText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 112,
    gap: spacing.md,
  },
  workoutNameInput: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    paddingVertical: 4,
  },
  restCard: {
    padding: spacing.md,
  },
  restRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  restLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  restTime: {
    color: colors.teal,
    fontSize: 26,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  restHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  restActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  restCancel: {
    minHeight: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  restCancelText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "800",
  },
  restDurationButton: {
    minHeight: 36,
    borderRadius: radius.md,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  restDurationText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  restPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  restPickerButton: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  restPickerButtonActive: {
    backgroundColor: colors.teal,
  },
  restPickerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  restPickerTextActive: {
    color: colors.background,
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
    marginBottom: spacing.md,
    gap: spacing.md,
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
  exerciseHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  exerciseMoveButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledMoveButton: {
    opacity: 0.3,
  },
  removeExerciseButton: {
    borderRadius: radius.md,
    borderColor: colors.red,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeExerciseText: {
    color: colors.red,
    fontSize: 11,
    fontWeight: "900",
  },
  lastSessionBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  lastSessionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
  },
  lastSessionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lastSessionText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  compactSetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  compactSetHeaderSet: {
    width: 42,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  compactSetHeaderMain: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  compactSetHeaderDone: {
    width: 74,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  setList: {
    gap: 8,
  },
  compactSetRow: {
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  setRowComplete: {
    backgroundColor: colors.tealSoft,
  },
  compactSetNumber: {
    width: 28,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  setNumberCompleteText: {
    color: colors.teal,
  },
  compactSetValueButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  compactSetValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  compactSetHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  compactSetActions: {
    width: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  completeSetButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  completeSetButtonActive: {
    backgroundColor: colors.teal,
  },
  removeSetButton: {
    width: 28,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  addSetButton: {
    marginTop: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addSetText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
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
  summaryBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === "android" ? 18 : spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryCenter: {
    alignItems: "center",
  },
  summaryRight: {
    alignItems: "flex-end",
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  summaryMuted: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  setEditorBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  setEditorCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  setEditorExercise: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "capitalize",
  },
  setEditorTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  setEditorSection: {
    marginBottom: spacing.lg,
  },
  setEditorLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: spacing.md,
  },
  setEditorControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  setEditorBigButton: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  setEditorBigButtonText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  setEditorValueBox: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  setEditorInput: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    minWidth: 80,
    padding: 0,
  },
  setEditorUnit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: -2,
  },
  setEditorDoneButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  setEditorDoneText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  searchBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  searchCard: {
    maxHeight: "86%",
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
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontWeight: "700",
  },
  searchCancelButton: {
    minHeight: 44,
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
  recapBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  recapCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  recapEmoji: {
    fontSize: 34,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  recapTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },
  recapWorkoutName: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.lg,
    textTransform: "capitalize",
  },
  recapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  recapTile: {
    width: "47.5%",
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  recapValue: {
    color: colors.teal,
    fontSize: 22,
    fontWeight: "900",
  },
  recapLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  templateUpdateBox: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  templateUpdateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  templateUpdateText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  templateUpdateButton: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  templateUpdateButtonSaved: {
    backgroundColor: colors.tealSoft,
  },
  templateUpdateButtonText: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: "900",
  },
  recapButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  recapButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
})