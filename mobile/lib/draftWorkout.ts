import { MobileActiveWorkoutResponse } from "@/types/activeWorkout"
import { MobileWorkoutTemplate } from "@/types/workouts"

function makeDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toDraftNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isCardioTemplateExercise(exerciseName: string, muscleGroup?: string | null) {
  const name = exerciseName.toLowerCase()
  const group = String(muscleGroup || "").toLowerCase()

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
  )
}

export function buildDraftWorkoutFromTemplate({
  template,
  startedFromQueuedTemplate,
}: {
  template: MobileWorkoutTemplate
  startedFromQueuedTemplate: boolean
}): MobileActiveWorkoutResponse {
  const workoutId = makeDraftId("draft-workout")
  const exercises = template.exercises ?? []
  const lastSetsByExercise = template.lastSetsByExercise ?? {}

  return {
    isDraft: true,
    startedFromTemplateId: template.id,
    startedFromQueuedTemplate,
    template: {
      id: template.id,
      name: template.name,
    },
    workout: {
      id: workoutId,
      user_id: "local",
      name: template.name,
      performed_at: new Date().toISOString(),
      duration_minutes: null,
      notes: null,
      isTemp: true,
    },
    exercises: exercises.map((exercise, exerciseIndex) => {
      const workoutExerciseId = makeDraftId(`draft-exercise-${exerciseIndex}`)
      const lastSets = lastSetsByExercise[exercise.exercise_name] ?? []
      const setCount = Math.max(1, toDraftNumber(exercise.default_sets, 3))
      const cardio = isCardioTemplateExercise(
        exercise.exercise_name,
        exercise.muscle_group
      )

      return {
        id: workoutExerciseId,
        workout_id: workoutId,
        exercise_name: exercise.exercise_name,
        exercise_external_id: null,
        muscle_group: cardio ? "cardio" : exercise.muscle_group,
        order_index: exercise.order_index ?? exerciseIndex,
        isTemp: true,
        last_session: lastSets,
        sets: Array.from({ length: setCount }, (_, setIndex) => {
          const setNumber = setIndex + 1
          const lastSet = lastSets.find((set) => set.set_number === setNumber)

          return {
            id: makeDraftId(`draft-set-${exerciseIndex}-${setIndex}`),
            workout_exercise_id: workoutExerciseId,
            set_number: setNumber,

            reps: cardio
              ? 0
              : toDraftNumber(lastSet?.reps ?? exercise.default_reps, 8),

            weight_kg: cardio
              ? 0
              : toDraftNumber(
                  lastSet?.weight_kg ?? exercise.default_weight_kg,
                  0
                ),

            duration_minutes: cardio
              ? toDraftNumber(
                  lastSet?.duration_minutes ??
                    exercise.default_duration_minutes,
                  20
                )
              : null,

            speed: cardio
              ? toDraftNumber(lastSet?.speed ?? exercise.default_speed, 0)
              : null,

            distance: cardio
              ? toDraftNumber(
                  lastSet?.distance ?? exercise.default_distance,
                  0
                )
              : null,

            incline: cardio
              ? toDraftNumber(lastSet?.incline ?? exercise.default_incline, 0)
              : null,

            completed: false,
            isTemp: true,
          }
        }),
      }
    }),
  }
}