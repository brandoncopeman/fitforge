// TDEE = Total Daily Energy Expenditure
// This is how many calories someone burns in a day based on their stats and activity level

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active"
export type Goal = "cut" | "maintain" | "bulk"
export type Sex = "male" | "female" | "other"

// How much extra calories each activity level burns
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,       // Desk job, no exercise
  light: 1.375,         // Light exercise 1-3 days/week
  moderate: 1.55,       // Moderate exercise 3-5 days/week
  active: 1.725,        // Hard exercise 6-7 days/week
  very_active: 1.9,     // Very hard exercise + physical job
}

export function calculateTDEE(
  weight_kg: number,
  height_cm: number,
  age: number,
  sex: Sex,
  activity_level: ActivityLevel,
  goal: Goal
) {
  // Step 1: Calculate BMR (how many calories your body burns at rest)
  let bmr: number
  if (sex === "male") {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
  } else {
    // female and other use the same formula
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
  }

  // Step 2: Multiply by activity level
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level]

  // Step 3: Adjust for goal
  let daily_calories: number
  if (goal === "cut") {
    daily_calories = tdee - 500   // Eat 500 less to lose ~0.5kg/week
  } else if (goal === "bulk") {
    daily_calories = tdee + 300   // Eat 300 more to gain muscle
  } else {
    daily_calories = tdee         // Maintain current weight
  }

  // Step 4: Calculate protein target (1.6g per kg of bodyweight)
  const daily_protein = Math.round(weight_kg * 1.6)

  return {
    daily_calories: Math.round(daily_calories),
    daily_protein,
  }
}