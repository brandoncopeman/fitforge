import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0]

  const entries = await sql`
    SELECT * FROM food_entries
    WHERE user_id = ${userId} AND log_date = ${date}
    ORDER BY consumed_at ASC
  `
  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const body = await req.json()
  const { food_name, calories, protein_g, carbs_g, fat_g, meal_type, serving_grams, log_date } = body

  const rows = await sql`
    INSERT INTO food_entries (user_id, food_name, calories, protein_g, carbs_g, fat_g, meal_type, serving_grams, log_date)
    VALUES (
      ${userId},
      ${food_name},
      ${calories},
      ${protein_g || 0},
      ${carbs_g || 0},
      ${fat_g || 0},
      ${meal_type || "snack"},
      ${serving_grams || null},
      ${log_date || new Date().toISOString().split("T")[0]}
    )
    RETURNING *
  `
  return NextResponse.json(rows[0])
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { id, calories, protein_g, carbs_g, fat_g, serving_grams } = await req.json()

  const rows = await sql`
    UPDATE food_entries SET
      calories = ${calories},
      protein_g = ${protein_g},
      carbs_g = ${carbs_g},
      fat_g = ${fat_g},
      serving_grams = ${serving_grams}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  return NextResponse.json(rows[0])
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  await sql`DELETE FROM food_entries WHERE id = ${id} AND user_id = ${userId}`
  return NextResponse.json({ success: true })
}