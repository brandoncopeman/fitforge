import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { calculateTDEE } from "@/lib/tdee"

export async function POST(req: Request) {
  // Get the logged-in user's ID from Clerk
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  // Get the form data sent from the onboarding page
  const body = await req.json()
  const {
    display_name,
    weight_kg,
    height_cm,
    age,
    sex,
    activity_level,
    goal,
    daily_step_target,
    weekly_workout_target,
  } = body

  // Calculate calorie and protein targets
  const { daily_calories, daily_protein } = calculateTDEE(
    weight_kg,
    height_cm,
    age,
    sex,
    activity_level,
    goal
  )

  // Save everything to the profiles table in Neon
  await sql`
    INSERT INTO profiles (
      id,
      display_name,
      weight_kg,
      height_cm,
      age,
      sex,
      activity_level,
      goal,
      daily_calorie_target,
      daily_protein_target,
      daily_step_target,
      weekly_workout_target
    ) VALUES (
      ${userId},
      ${display_name},
      ${weight_kg},
      ${height_cm},
      ${age},
      ${sex},
      ${activity_level},
      ${goal},
      ${daily_calories},
      ${daily_protein},
      ${daily_step_target ?? 8000},
      ${weekly_workout_target ?? 3}
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = ${display_name},
      weight_kg = ${weight_kg},
      height_cm = ${height_cm},
      age = ${age},
      sex = ${sex},
      activity_level = ${activity_level},
      goal = ${goal},
      daily_calorie_target = ${daily_calories},
      daily_protein_target = ${daily_protein},
      daily_step_target = ${daily_step_target ?? 8000},
      weekly_workout_target = ${weekly_workout_target ?? 3}
  `

  return NextResponse.json({ 
    success: true,
    daily_calories,
    daily_protein,
  })
}

// GET route to fetch the current user's profile
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const rows = await sql`
    SELECT * FROM profiles WHERE id = ${userId}
  `

  if (rows.length === 0) {
    return NextResponse.json({ profile: null })
  }

  return NextResponse.json({ profile: rows[0] })
}