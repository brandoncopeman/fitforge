import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const rows = await sql`
    SELECT gs.*, wt.name as template_name
    FROM gym_schedule gs
    LEFT JOIN workout_templates wt ON gs.template_id = wt.id
    WHERE gs.user_id = ${userId}
  `
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { day_of_week, template_id } = await req.json()

  const rows = await sql`
    INSERT INTO gym_schedule (user_id, day_of_week, template_id)
    VALUES (${userId}, ${day_of_week}, ${template_id || null})
    ON CONFLICT (user_id, day_of_week) DO UPDATE SET
      template_id = ${template_id || null}
    RETURNING *
  `
  return NextResponse.json(rows[0])
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { day_of_week } = await req.json()

  await sql`
    DELETE FROM gym_schedule
    WHERE user_id = ${userId} AND day_of_week = ${day_of_week}
  `
  return NextResponse.json({ success: true })
}