import { MobileActiveWorkoutResponse } from "@/types/activeWorkout"
import { MobileWorkoutTemplate } from "@/types/workouts"

function makeDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
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
      const setCount = Math.max(1, Number(exercise.default_sets ?? 3))

      return {
        id: workoutExerciseId,
        workout_id: workoutId,
        exercise_name: exercise.exercise_name,
        exercise_external_id: null,
        muscle_group: exercise.muscle_group,
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
            reps: lastSet?.reps ?? Number(exercise.default_reps ?? 8),
            weight_kg:
              lastSet?.weight_kg ?? Number(exercise.default_weight_kg ?? 0),
            completed: false,
            isTemp: true,
          }
        }),
      }
    }),
  }
}