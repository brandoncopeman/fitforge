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

function getTodayDate() {
  return new Date().toISOString().split("T")[0]
}

export async function GET(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date") || getTodayDate()

  const entries = await sql`
    SELECT *
    FROM food_entries
    WHERE user_id = ${userId}
      AND log_date = ${date}
    ORDER BY consumed_at ASC
  `

  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()

  const {
    food_name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    meal_type,
    serving_grams,
    log_date,
  } = body

  const rows = await sql`
    INSERT INTO food_entries (
      user_id,
      food_name,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      meal_type,
      serving_grams,
      log_date
    )
    VALUES (
      ${userId},
      ${food_name || "Food"},
      ${toNumber(calories, 0)},
      ${toNumber(protein_g, 0)},
      ${toNumber(carbs_g, 0)},
      ${toNumber(fat_g, 0)},
      ${meal_type || "snack"},
      ${toNumberOrNull(serving_grams)},
      ${log_date || getTodayDate()}
    )
    RETURNING *
  `

  return NextResponse.json(rows[0])
}

export async function PATCH(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()

  const {
    id,
    food_name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    meal_type,
    serving_grams,
  } = body

  if (!id) {
    return NextResponse.json({ error: "Missing entry id" }, { status: 400 })
  }

  const rows = await sql`
    UPDATE food_entries SET
      food_name = ${food_name || "Food"},
      calories = ${toNumber(calories, 0)},
      protein_g = ${toNumber(protein_g, 0)},
      carbs_g = ${toNumber(carbs_g, 0)},
      fat_g = ${toNumber(fat_g, 0)},
      meal_type = ${meal_type || "snack"},
      serving_grams = ${toNumberOrNull(serving_grams)}
    WHERE id = ${id}
      AND user_id = ${userId}
    RETURNING *
  `

  if (!rows[0]) {
    return NextResponse.json({ error: "Food entry not found" }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}

export async function DELETE(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing entry id" }, { status: 400 })
  }

  await sql`
    DELETE FROM food_entries
    WHERE id = ${id}
      AND user_id = ${userId}
  `

  return NextResponse.json({ success: true })
}