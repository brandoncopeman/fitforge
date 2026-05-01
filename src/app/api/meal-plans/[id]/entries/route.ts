import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params
  const { food_name, calories, protein_g, carbs_g, fat_g, meal_type, serving_grams } = await req.json()

  const rows = await sql`
    INSERT INTO meal_plan_entries (meal_plan_id, food_name, calories, protein_g, carbs_g, fat_g, meal_type, serving_grams)
    VALUES (${id}, ${food_name}, ${calories}, ${protein_g || 0}, ${carbs_g || 0}, ${fat_g || 0}, ${meal_type || "snack"}, ${serving_grams || null})
    RETURNING *
  `
  return NextResponse.json(rows[0])
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const entryId = searchParams.get("entryId")

  await sql`DELETE FROM meal_plan_entries WHERE id = ${entryId} AND meal_plan_id = ${id}`
  return NextResponse.json({ success: true })
}