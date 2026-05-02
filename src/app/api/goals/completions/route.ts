import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") // YYYY-MM

  const completions = month ? await sql`
    SELECT * FROM goal_completions
    WHERE user_id = ${userId}
      AND completed_date >= ${month + '-01'}
      AND completed_date < (date_trunc('month', ${month + '-01'}::date) + interval '1 month')::date
  ` : await sql`
    SELECT * FROM goal_completions
    WHERE user_id = ${userId}
      AND completed_date >= CURRENT_DATE - INTERVAL '60 days'
  `

  return NextResponse.json(completions)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { goal_id, completed_date } = await req.json()
  const date = completed_date || new Date().toISOString().split("T")[0]

  const rows = await sql`
    INSERT INTO goal_completions (user_id, goal_id, completed_date)
    VALUES (${userId}, ${goal_id}, ${date})
    ON CONFLICT (user_id, goal_id, completed_date) DO NOTHING
    RETURNING *
  `
  return NextResponse.json(rows[0] || { goal_id, completed_date: date })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const goal_id = searchParams.get("goal_id")
  const completed_date = searchParams.get("date")

  await sql`
    DELETE FROM goal_completions
    WHERE user_id = ${userId} AND goal_id = ${goal_id} AND completed_date = ${completed_date}
  `
  return NextResponse.json({ success: true })
}