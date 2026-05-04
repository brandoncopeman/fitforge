export type MobileExerciseSet = {
    id: string
    workout_exercise_id: string
    set_number: number
    reps: number
    weight_kg: number | string
    created_at?: string
  }
  
  export type MobileWorkoutExercise = {
    id: string
    workout_id: string
    exercise_name: string
    exercise_external_id: string | null
    muscle_group: string | null
    order_index: number | null
    sets: MobileExerciseSet[]
  }
  
  export type MobileWorkout = {
    id: string
    user_id: string
    name: string
    performed_at: string
    duration_minutes: number | null
    notes: string | null
  }
  
  export type MobileActiveWorkoutResponse = {
    workout: MobileWorkout
    exercises: MobileWorkoutExercise[]
  }