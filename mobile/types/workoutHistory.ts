export type MobileWorkoutHistoryItem = {
    id: string
    name: string
    performed_at: string
    duration_minutes: number | null
    exercise_count: number
    set_count: number
    completed_set_count: number
    volume: number
  }
  
  export type MobileWorkoutHistoryResponse = {
    workouts: MobileWorkoutHistoryItem[]
  }