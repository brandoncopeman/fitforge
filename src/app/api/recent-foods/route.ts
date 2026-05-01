import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const foods = await sql`
    SELECT * FROM recent_foods
    WHERE user_id = ${userId}
    ORDER BY last_used DESC
    LIMIT 10
  `
  return NextResponse.json(foods)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { food_name, calories, protein_g, carbs_g, fat_g, serving_grams } = await req.json()

  await sql`
    INSERT INTO recent_foods (user_id, food_name, calories, protein_g, carbs_g, fat_g, serving_grams)
    VALUES (${userId}, ${food_name}, ${calories}, ${protein_g || 0}, ${carbs_g || 0}, ${fat_g || 0}, ${serving_grams || null})
    ON CONFLICT (user_id, food_name) DO UPDATE SET
      last_used = NOW(),
      use_count = recent_foods.use_count + 1,
      calories = ${calories},
      protein_g = ${protein_g || 0},
      carbs_g = ${carbs_g || 0},
      fat_g = ${fat_g || 0},
      serving_grams = ${serving_grams || null}
  `
  return NextResponse.json({ success: true })
}