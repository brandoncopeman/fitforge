export type MobileStepLog = {
    id: string
    user_id?: string
    steps: number | string
    log_date: string
    created_at?: string
    updated_at?: string
    isTemp?: boolean
  }
  
  export type MobileStepGoalResponse = {
    success: boolean
    daily_step_target: number
  }