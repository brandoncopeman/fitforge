export type MobileStatsSet = {
    id: string
    workout_exercise_id: string
    set_number: number
    reps: number
    weight_kg: number
  }
  
  export type MobileStatsExercise = {
    id: string
    workout_id: string
    exercise_name: string
    muscle_group: string | null
    order_index: number | null
    sets: MobileStatsSet[]
  }
  
  export type MobileStatsWorkout = {
    id: string
    name: string
    created_at: string
    duration_minutes: number | null
    exercises: MobileStatsExercise[]
  }
  
  export type MobileStatsResponse = {
    workouts: MobileStatsWorkout[]
  }