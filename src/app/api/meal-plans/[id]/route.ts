import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params

  const [plan, entries] = await Promise.all([
    sql`SELECT * FROM meal_plans WHERE id = ${id} AND user_id = ${userId}`,
    sql`SELECT * FROM meal_plan_entries WHERE meal_plan_id = ${id} ORDER BY meal_type, food_name`,
  ])

  return NextResponse.json({ plan: plan[0], entries })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params
  const { name } = await req.json()

  await sql`UPDATE meal_plans SET name = ${name} WHERE id = ${id} AND user_id = ${userId}`
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params

  await sql`DELETE FROM meal_plans WHERE id = ${id} AND user_id = ${userId}`
  return NextResponse.json({ success: true })
}