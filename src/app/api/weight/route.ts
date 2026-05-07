import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { generateWeightProgressStory } from "@/lib/progress-storytelling"

type WeightLogRow = {
  id: string
  user_id: string
  weight_kg: number | string
  log_date: string
  created_at?: string
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0]
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (date) {
    if (!isValidDateString(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }

    const rows = await sql`
      SELECT *
      FROM weight_logs
      WHERE user_id = ${userId}
        AND log_date = ${date}
      ORDER BY created_at DESC
      LIMIT 1
    `

    return NextResponse.json(rows[0] ?? null)
  }

  if (from && to) {
    if (!isValidDateString(from) || !isValidDateString(to)) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }

    const rows = await sql`
      SELECT DISTINCT ON (log_date)
        *
      FROM weight_logs
      WHERE user_id = ${userId}
        AND log_date BETWEEN ${from} AND ${to}
      ORDER BY log_date DESC, created_at DESC
    `

    return NextResponse.json(rows)
  }

  const rows = await sql`
    SELECT DISTINCT ON (log_date)
      *
    FROM weight_logs
    WHERE user_id = ${userId}
    ORDER BY log_date DESC, created_at DESC
    LIMIT 120
  `

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()

  const weightKg = Math.round(toNumber(body.weight_kg, 0) * 10) / 10
  const logDate = body.log_date || getTodayDate()

  if (weightKg <= 0) {
    return NextResponse.json(
      { error: "Weight must be greater than 0" },
      { status: 400 }
    )
  }

  if (!isValidDateString(logDate)) {
    return NextResponse.json({ error: "Invalid log_date" }, { status: 400 })
  }

  const existingRows = await sql`
    SELECT id
    FROM weight_logs
    WHERE user_id = ${userId}
      AND log_date = ${logDate}
    ORDER BY created_at DESC
    LIMIT 1
  `

  if (existingRows[0]) {
    const rows = await sql`
      UPDATE weight_logs
      SET weight_kg = ${weightKg}
      WHERE id = ${existingRows[0].id}
        AND user_id = ${userId}
      RETURNING *
    `

    generateWeightProgressStory(userId).catch((err) => {
      console.error("Failed to generate weight progress story", err)
    })

    return NextResponse.json(rows[0] as WeightLogRow)
  }

  const rows = await sql`
    INSERT INTO weight_logs (
      user_id,
      weight_kg,
      log_date
    )
    VALUES (
      ${userId},
      ${weightKg},
      ${logDate}
    )
    RETURNING *
  `

  generateWeightProgressStory(userId).catch((err) => {
    console.error("Failed to generate weight progress story", err)
  })

  return NextResponse.json(rows[0] as WeightLogRow)
}