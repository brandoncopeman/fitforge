export type GoalColor =
  | "teal"
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "red"

  export type MobileGoal = {
    id: string
    user_id?: string
    name: string
    emoji: string
    color: GoalColor | string
    order_index: number | string | null
    active: boolean
    target_days_per_week: number | string | null
    created_at?: string
    isTemp?: boolean
  }

export type MobileGoalCompletion = {
  id?: string
  user_id?: string
  goal_id: string
  completed_date: string
  created_at?: string
  isTemp?: boolean
}

export type MobileGoalPayload = {
    name: string
    emoji: string
    color: GoalColor
    target_days_per_week: number
  }