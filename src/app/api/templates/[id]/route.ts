import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params

  const rows = await sql`SELECT * FROM workout_templates WHERE id = ${id} AND user_id = ${userId}`
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const exercises = await sql`
    SELECT * FROM template_exercises WHERE template_id = ${id} ORDER BY order_index ASC
  `
  return NextResponse.json({ template: rows[0], exercises })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { name, in_plan, plan_order } = body

  const rows = await sql`
    UPDATE workout_templates SET
      name = COALESCE(${name}, name),
      in_plan = COALESCE(${in_plan}, in_plan),
      plan_order = COALESCE(${plan_order}, plan_order)
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  return NextResponse.json(rows[0])
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params

  await sql`DELETE FROM workout_templates WHERE id = ${id} AND user_id = ${userId}`
  return NextResponse.json({ success: true })
}