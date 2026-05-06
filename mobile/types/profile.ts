export type MobileProfile = {
    id: string
    display_name: string | null
    weight_kg: number | string | null
    height_cm: number | string | null
    age: number | string | null
    sex: string | null
    activity_level: string | null
    goal: string | null
    daily_calorie_target: number | string | null
    daily_protein_target: number | string | null
    daily_step_target: number | string | null
    weekly_workout_target: number | string | null
    last_plan_index?: number | string | null
    show_weight_on_home?: boolean | null
    goal_weight_kg?: number | string | null
    nav_items?: string[] | null
    home_section_order?: string[] | null
  }
  
  export type MobileProfileResponse = {
    profile: MobileProfile | null
  }
  
  export type MobileProfileSettingsPatch = {
    show_weight_on_home?: boolean
    goal_weight_kg?: number | null
    home_section_order?: string[]
  }
  
  export type MobileProfileCorePayload = {
    display_name: string
    weight_kg: number
    height_cm: number
    age: number
    sex: string
    activity_level: string
    goal: string
    daily_step_target?: number
    weekly_workout_target?: number
  }