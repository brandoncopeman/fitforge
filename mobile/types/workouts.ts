export type MobileWorkoutTemplate = {
    id: string
    name: string
    in_plan: boolean
    plan_order: number | null
    created_at: string
    exercise_count: number
  }
  
  export type MobileTemplatesResponse = {
    templates: MobileWorkoutTemplate[]
    plan: {
      lastPlanIndex: number
      nextPlanIndex: number
      nextTemplate: MobileWorkoutTemplate | null
    }
  }