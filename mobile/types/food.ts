export type MealType = "breakfast" | "lunch" | "dinner" | "snack"

export type MobileFoodEntry = {
  id: string
  user_id?: string
  food_name: string
  calories: number | string
  protein_g: number | string
  carbs_g: number | string
  fat_g: number | string
  meal_type: MealType
  serving_grams: number | string | null
  log_date: string
  consumed_at?: string
  isTemp?: boolean
}

export type MobileRecentFood = {
  id: string
  user_id?: string
  food_name: string
  calories: number | string
  protein_g: number | string
  carbs_g: number | string
  fat_g: number | string
  serving_grams: number | string | null
  last_used?: string
  use_count?: number | string
}

export type MobileFoodEntryPayload = {
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal_type: MealType
  serving_grams: number | null
  log_date: string
}