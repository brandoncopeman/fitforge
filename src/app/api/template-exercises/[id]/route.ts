import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { exercise_name, muscle_group, order_index, default_sets, default_reps, default_weight_kg } = body

  const rows = await sql`
    UPDATE template_exercises te SET
      exercise_name = COALESCE(${exercise_name}, te.exercise_name),
      muscle_group = COALESCE(${muscle_group}, te.muscle_group),
      order_index = COALESCE(${order_index}, te.order_index),
      default_sets = COALESCE(${default_sets}, te.default_sets),
      default_reps = COALESCE(${default_reps}, te.default_reps),
      default_weight_kg = COALESCE(${default_weight_kg}, te.default_weight_kg)
    WHERE te.id = ${id}
    RETURNING *
  `
  return NextResponse.json(rows[0])
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params

  await sql`DELETE FROM template_exercises WHERE id = ${id}`
  return NextResponse.json({ success: true })
}