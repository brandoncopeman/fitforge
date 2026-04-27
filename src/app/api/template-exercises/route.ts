import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const body = await req.json()
  const { template_id, exercise_name, muscle_group, order_index, default_sets, default_reps, default_weight_kg } = body

  const check = await sql`SELECT id FROM workout_templates WHERE id = ${template_id} AND user_id = ${userId}`
  if (check.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rows = await sql`
    INSERT INTO template_exercises (template_id, exercise_name, muscle_group, order_index, default_sets, default_reps, default_weight_kg)
    VALUES (${template_id}, ${exercise_name}, ${muscle_group || "other"}, ${order_index || 0}, ${default_sets || 3}, ${default_reps || 8}, ${default_weight_kg || 0})
    RETURNING *
  `
  return NextResponse.json(rows[0])
}