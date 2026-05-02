import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { generateWeightProgressStory } from "@/lib/progress-storytelling"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const logs = await sql`
    SELECT * FROM weight_logs
    WHERE user_id = ${userId}
    ORDER BY log_date DESC
    LIMIT 60
  `

  return NextResponse.json(logs)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { weight_kg, log_date } = await req.json()
  const date = log_date || new Date().toISOString().split("T")[0]

  const rows = await sql`
    INSERT INTO weight_logs (user_id, weight_kg, log_date)
    VALUES (${userId}, ${weight_kg}, ${date})
    ON CONFLICT (user_id, log_date) DO UPDATE SET weight_kg = ${weight_kg}
    RETURNING *
  `

  generateWeightProgressStory(userId).catch(console.error)

  return NextResponse.json(rows[0])
}