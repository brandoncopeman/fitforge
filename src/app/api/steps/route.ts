import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { generateStepProgressStory } from "@/lib/progress-storytelling"

type StepLogRow = {
  id: string
  user_id: string
  steps: number | string
  log_date: string
  created_at?: string
  updated_at?: string
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
      FROM step_logs
      WHERE user_id = ${userId}
        AND log_date = ${date}
      LIMIT 1
    `

    return NextResponse.json(rows[0] ?? null)
  }

  if (from && to) {
    if (!isValidDateString(from) || !isValidDateString(to)) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }

    const rows = await sql`
      SELECT *
      FROM step_logs
      WHERE user_id = ${userId}
        AND log_date BETWEEN ${from} AND ${to}
      ORDER BY log_date DESC
    `

    return NextResponse.json(rows)
  }

  const rows = await sql`
    SELECT *
    FROM step_logs
    WHERE user_id = ${userId}
    ORDER BY log_date DESC
  `

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()

  const steps = Math.max(0, Math.round(toNumber(body.steps, 0)))
  const logDate = body.log_date || getTodayDate()

  if (!isValidDateString(logDate)) {
    return NextResponse.json({ error: "Invalid log_date" }, { status: 400 })
  }

  const rows = await sql`
    INSERT INTO step_logs (
      user_id,
      log_date,
      steps
    )
    VALUES (
      ${userId},
      ${logDate},
      ${steps}
    )
    ON CONFLICT (user_id, log_date) DO UPDATE SET
      steps = ${steps}
    RETURNING *
  `

  generateStepProgressStory(userId, logDate).catch((err) => {
    console.error("Failed to generate step progress story", err)
  })

  return NextResponse.json(rows[0] as StepLogRow)
}