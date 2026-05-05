export type MobileTemplateExercise = {
  id: string
  template_id: string
  exercise_name: string
  muscle_group: string | null
  order_index: number | null
  default_sets: number | null
  default_reps: number | null
  default_weight_kg: number | string | null
  default_duration_minutes?: number | string | null
  default_speed?: number | string | null
  default_distance?: number | string | null
  default_incline?: number | string | null
}

export type MobileLastSet = {
  set_number: number
  weight_kg: number | string
  reps: number | string
  duration_minutes?: number | string | null
  speed?: number | string | null
  distance?: number | string | null
  incline?: number | string | null
}

export type MobileWorkoutTemplate = {
  id: string
  user_id?: string
  name: string
  in_plan: boolean
  plan_order: number | null
  created_at: string
  exercise_count: number
  exercises?: MobileTemplateExercise[]
  lastSetsByExercise?: Record<string, MobileLastSet[]>
}

export type MobileTemplatesResponse = {
  templates: MobileWorkoutTemplate[]
  plan: {
    lastPlanIndex: number
    nextPlanIndex: number
    nextTemplate: MobileWorkoutTemplate | null
  }
}