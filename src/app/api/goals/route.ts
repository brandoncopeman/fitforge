import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function clampTargetDays(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 7
  return Math.min(7, Math.max(1, Math.round(parsed)))
}

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const goals = await sql`
    SELECT *
    FROM goals
    WHERE user_id = ${userId}
      AND active = true
    ORDER BY order_index ASC, created_at ASC
  `

  return NextResponse.json(goals)
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()

  const name = cleanText(body.name, "")
  const emoji = cleanText(body.emoji, "🎯")
  const color = cleanText(body.color, "teal")
  const targetDaysPerWeek = clampTargetDays(body.target_days_per_week ?? 7)

  if (!name) {
    return NextResponse.json({ error: "Goal name is required" }, { status: 400 })
  }

  const orderRows = await sql`
    SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order
    FROM goals
    WHERE user_id = ${userId}
      AND active = true
  `

  const order = Number(orderRows[0]?.next_order ?? 0)

  const rows = await sql`
    INSERT INTO goals (
      user_id,
      name,
      emoji,
      color,
      order_index,
      active,
      target_days_per_week
    )
    VALUES (
      ${userId},
      ${name},
      ${emoji},
      ${color},
      ${order},
      true,
      ${targetDaysPerWeek}
    )
    RETURNING *
  `

  return NextResponse.json(rows[0])
}