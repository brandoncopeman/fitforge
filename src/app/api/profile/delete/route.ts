import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function DELETE(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)

  if (body?.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation text must be DELETE" },
      { status: 400 }
    )
  }

  try {
    await sql`
      DELETE FROM goal_completions
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM goals
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM gym_schedule
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM step_logs
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM weight_logs
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM food_entries
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM recent_foods
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM meal_plan_entries
      WHERE meal_plan_id IN (
        SELECT id FROM meal_plans WHERE user_id = ${userId}
      )
    `

    await sql`
      DELETE FROM meal_plans
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM favourite_exercises
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM custom_exercises
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM exercise_sets
      WHERE workout_exercise_id IN (
        SELECT we.id
        FROM workout_exercises we
        JOIN workouts w ON w.id = we.workout_id
        WHERE w.user_id = ${userId}
      )
    `

    await sql`
      DELETE FROM workout_exercises
      WHERE workout_id IN (
        SELECT id FROM workouts WHERE user_id = ${userId}
      )
    `

    await sql`
      DELETE FROM workouts
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM template_exercises
      WHERE template_id IN (
        SELECT id FROM workout_templates WHERE user_id = ${userId}
      )
    `

    await sql`
      DELETE FROM workout_templates
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM achievement_badges
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM progress_events
      WHERE user_id = ${userId}
    `

    await sql`
      DELETE FROM profiles
      WHERE id = ${userId}
    `

    const clerk = await clerkClient()
    await clerk.users.deleteUser(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    )
  }
}