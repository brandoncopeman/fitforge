import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const foods = await sql`
    SELECT *
    FROM recent_foods
    WHERE user_id = ${userId}
    ORDER BY use_count DESC, last_used DESC
    LIMIT 20
  `

  return NextResponse.json(foods)
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const {
    food_name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    serving_grams,
  } = await req.json()

  await sql`
    INSERT INTO recent_foods (
      user_id,
      food_name,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      serving_grams
    )
    VALUES (
      ${userId},
      ${food_name || "Food"},
      ${toNumber(calories, 0)},
      ${toNumber(protein_g, 0)},
      ${toNumber(carbs_g, 0)},
      ${toNumber(fat_g, 0)},
      ${toNumberOrNull(serving_grams)}
    )
    ON CONFLICT (user_id, food_name) DO UPDATE SET
      last_used = NOW(),
      use_count = recent_foods.use_count + 1,
      calories = ${toNumber(calories, 0)},
      protein_g = ${toNumber(protein_g, 0)},
      carbs_g = ${toNumber(carbs_g, 0)},
      fat_g = ${toNumber(fat_g, 0)},
      serving_grams = ${toNumberOrNull(serving_grams)}
  `

  return NextResponse.json({ success: true })
}