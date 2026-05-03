export type MobileHomeResponse = {
    onboardingRequired: boolean
  
    profile: {
      id: string
      display_name: string | null
      daily_calorie_target: number
      daily_protein_target: number
      daily_step_target: number
      show_weight_on_home: boolean
      daily_quote: {
        text: string
        author: string
      }
    } | null
  
    dashboard: {
      caloriesConsumed: number
      todaySteps: number
      latestWeight: number | null
      todayDow: number
      sectionOrder: string[]
    }
  
    plan: {
      templates: {
        id: string
        name: string
        in_plan: boolean
        plan_order: number | null
        exercise_count: number
      }[]
      lastPlanIndex: number
      nextPlanIndex: number
      nextTemplate: {
        id: string
        name: string
        exercise_count: number
      } | null
      status: {
        weeklyTarget: number
        completedThisWeek: number
        remainingThisWeek: number
        status: "no_plan" | "on_track" | "behind" | "complete"
        title: string
        message: string
        emoji: string
        streakWeeks: number
      }
    }
  
    schedule: {
      day_of_week: number
      template_id: string | null
      template_name: string | null
    }[]
  
    progress: {
      events: {
        id: string
        event_type: string
        title: string
        message: string
        emoji: string | null
        created_at: string
      }[]
      weeklyRecap: {
        id: string
        title: string
        message: string
        emoji: string | null
        workouts: number
        volume: number
        averageDailyCalories: number
        steps: number
        goals: number
        weightChange: number | null
        created_at: string
      } | null
    }
  }