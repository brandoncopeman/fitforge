import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type MealPlanEntry = {
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal_type: string
  serving_grams: number | null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params
  const { log_date } = await req.json()
  const date = log_date || new Date().toISOString().split("T")[0]

  const entries = await sql`SELECT * FROM meal_plan_entries WHERE meal_plan_id = ${id}`

  const inserted = await Promise.all(
    (entries as MealPlanEntry[]).map((e) => sql`
      INSERT INTO food_entries (user_id, food_name, calories, protein_g, carbs_g, fat_g, meal_type, serving_grams, log_date)
      VALUES (${userId}, ${e.food_name}, ${e.calories}, ${e.protein_g}, ${e.carbs_g}, ${e.fat_g}, ${e.meal_type}, ${e.serving_grams}, ${date})
      RETURNING *
    `.then(r => r[0]))
  )

  return NextResponse.json(inserted)
}