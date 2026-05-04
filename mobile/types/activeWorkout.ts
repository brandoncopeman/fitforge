export type MobileExerciseSet = {
  id: string
  workout_exercise_id: string
  set_number: number
  reps: number | ""
  weight_kg: number | string | ""
  created_at?: string
  completed?: boolean
  isTemp?: boolean
}

export type MobileWorkoutExercise = {
  id: string
  workout_id: string
  exercise_name: string
  exercise_external_id: string | null
  muscle_group: string | null
  order_index: number | null
  sets: MobileExerciseSet[]
  last_session?: {
    set_number: number
    weight_kg: number | string
    reps: number
  }[]
  isTemp?: boolean
}

export type MobileWorkout = {
  id: string
  user_id: string
  name: string
  performed_at: string
  duration_minutes: number | null
  notes: string | null
  isTemp?: boolean
}

export type MobileActiveWorkoutResponse = {
  workout: MobileWorkout
  template?: {
    id: string
    name: string
  }
  exercises: MobileWorkoutExercise[]
  startedFromTemplateId?: string
  startedFromQueuedTemplate?: boolean
  isDraft?: boolean
}