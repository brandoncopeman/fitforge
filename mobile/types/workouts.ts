export type MobileTemplateExercise = {
  id: string
  template_id: string
  exercise_name: string
  muscle_group: string | null
  order_index: number | null
  default_sets: number | null
  default_reps: number | null
  default_weight_kg: number | string | null
}

export type MobileLastSet = {
  exercise_name: string
  set_number: number
  weight_kg: number | string
  reps: number
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