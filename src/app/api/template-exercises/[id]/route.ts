import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const {
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

  const rows = await sql`
    UPDATE template_exercises te
    SET
      exercise_name = COALESCE(${exercise_name}, te.exercise_name),
      muscle_group = COALESCE(${muscle_group}, te.muscle_group),
      order_index = COALESCE(${order_index}, te.order_index),
      default_sets = COALESCE(${default_sets}, te.default_sets),
      default_reps = COALESCE(${default_reps}, te.default_reps),
      default_weight_kg = COALESCE(${default_weight_kg}, te.default_weight_kg),
      default_duration_minutes = COALESCE(${toNumberOrNull(default_duration_minutes)}, te.default_duration_minutes),
      default_speed = COALESCE(${toNumberOrNull(default_speed)}, te.default_speed),
      default_distance = COALESCE(${toNumberOrNull(default_distance)}, te.default_distance),
      default_incline = COALESCE(${toNumberOrNull(default_incline)}, te.default_incline)
    FROM workout_templates wt
    WHERE te.id = ${id}
      AND te.template_id = wt.id
      AND wt.user_id = ${userId}
    RETURNING te.*
  `

  if (!rows[0]) {
    return NextResponse.json({ error: "Template exercise not found" }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id } = await params

  await sql`
    DELETE FROM template_exercises te
    USING workout_templates wt
    WHERE te.id = ${id}
      AND te.template_id = wt.id
      AND wt.user_id = ${userId}
  `

  return NextResponse.json({ success: true })
}