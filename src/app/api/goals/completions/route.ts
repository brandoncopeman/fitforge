import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { generateGoalProgressStory } from "@/lib/progress-storytelling"

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
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const month = searchParams.get("month")
  const goalId = searchParams.get("goal_id")

  if (from && to) {
    if (!isValidDateString(from) || !isValidDateString(to)) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }

    const completions = goalId
      ? await sql`
          SELECT *
          FROM goal_completions
          WHERE user_id = ${userId}
            AND goal_id = ${goalId}
            AND completed_date >= ${from}
            AND completed_date <= ${to}
          ORDER BY completed_date DESC
        `
      : await sql`
          SELECT *
          FROM goal_completions
          WHERE user_id = ${userId}
            AND completed_date >= ${from}
            AND completed_date <= ${to}
          ORDER BY completed_date DESC
        `

    return NextResponse.json(completions)
  }

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 })
    }

    const monthStart = `${month}-01`

    const completions = await sql`
      SELECT *
      FROM goal_completions
      WHERE user_id = ${userId}
        AND completed_date >= ${monthStart}
        AND completed_date < (
          date_trunc('month', ${monthStart}::date) + interval '1 month'
        )::date
      ORDER BY completed_date DESC
    `

    return NextResponse.json(completions)
  }

  const completions = await sql`
    SELECT *
    FROM goal_completions
    WHERE user_id = ${userId}
      AND completed_date >= CURRENT_DATE - INTERVAL '90 days'
    ORDER BY completed_date DESC
  `

  return NextResponse.json(completions)
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()

  const goalId = body.goal_id
  const completedDate = body.completed_date || getTodayDate()

  if (!goalId) {
    return NextResponse.json({ error: "Missing goal_id" }, { status: 400 })
  }

  if (!isValidDateString(completedDate)) {
    return NextResponse.json(
      { error: "Invalid completed_date" },
      { status: 400 }
    )
  }

  const goalCheck = await sql`
    SELECT id
    FROM goals
    WHERE id = ${goalId}
      AND user_id = ${userId}
      AND active = true
    LIMIT 1
  `

  if (!goalCheck[0]) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 })
  }

  const rows = await sql`
    INSERT INTO goal_completions (
      user_id,
      goal_id,
      completed_date
    )
    VALUES (
      ${userId},
      ${goalId},
      ${completedDate}
    )
    ON CONFLICT (user_id, goal_id, completed_date) DO NOTHING
    RETURNING *
  `

  if (rows[0]) {
    generateGoalProgressStory(userId, goalId).catch((err) => {
      console.error("Failed to generate goal progress story", err)
    })
  }

  return NextResponse.json(
    rows[0] || {
      user_id: userId,
      goal_id: goalId,
      completed_date: completedDate,
    }
  )
}

export async function DELETE(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const goalId = searchParams.get("goal_id")
  const completedDate = searchParams.get("date")

  if (!goalId || !completedDate) {
    return NextResponse.json(
      { error: "Missing goal_id or date" },
      { status: 400 }
    )
  }

  if (!isValidDateString(completedDate)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  await sql`
    DELETE FROM goal_completions
    WHERE user_id = ${userId}
      AND goal_id = ${goalId}
      AND completed_date = ${completedDate}
  `

  return NextResponse.json({ success: true })
}