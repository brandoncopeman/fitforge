import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()

  const {
    template_id,
    exercise_name,
    muscle_group,
    order_index,
    default_sets,
    default_reps,
    default_weight_kg,
    default_duration_minutes,
    default_speed,
    default_distance,
    default_incline,
  } = body

  const check = await sql`
    SELECT id
    FROM workout_templates
    WHERE id = ${template_id}
      AND user_id = ${userId}
    LIMIT 1
  `

  if (!check[0]) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  const rows = await sql`
    INSERT INTO template_exercises (
      template_id,
      exercise_name,
      muscle_group,
      order_index,
      default_sets,
      default_reps,
      default_weight_kg,
      default_duration_minutes,
      default_speed,
      default_distance,
      default_incline
    )
    VALUES (
      ${template_id},
      ${exercise_name},
      ${muscle_group || "other"},
      ${Number(order_index ?? 0)},
      ${Math.max(1, Number(default_sets ?? 1))},
      ${Math.max(0, Number(default_reps ?? 0))},
      ${Math.max(0, Number(default_weight_kg ?? 0))},
      ${toNumberOrNull(default_duration_minutes)},
      ${toNumberOrNull(default_speed)},
      ${toNumberOrNull(default_distance)},
      ${toNumberOrNull(default_incline)}
    )
    RETURNING *
  `

  return NextResponse.json(rows[0])
}