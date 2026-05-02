import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { generateStepProgressStory } from "@/lib/progress-storytelling"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const [todayLog, recentLogs] = await Promise.all([
    sql`
      SELECT * FROM step_logs
      WHERE user_id = ${userId} AND log_date = CURRENT_DATE
    `,
    sql`
      SELECT * FROM step_logs
      WHERE user_id = ${userId}
      ORDER BY log_date DESC
      LIMIT 30
    `,
  ])

  return NextResponse.json({ today: todayLog[0] || null, logs: recentLogs })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { steps, log_date } = await req.json()
  const date = log_date || new Date().toISOString().split("T")[0]

  const rows = await sql`
    INSERT INTO step_logs (user_id, log_date, steps)
    VALUES (${userId}, ${date}, ${steps})
    ON CONFLICT (user_id, log_date) DO UPDATE SET steps = ${steps}
    RETURNING *
  `

  generateStepProgressStory(userId, date).catch(console.error)

  return NextResponse.json(rows[0])
}