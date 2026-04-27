import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const exercises = await sql`
    SELECT * FROM custom_exercises WHERE user_id = ${userId} ORDER BY name ASC
  `
  return NextResponse.json(exercises)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const body = await req.json()
  const { name, muscle_group } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const rows = await sql`
    INSERT INTO custom_exercises (user_id, name, muscle_group)
    VALUES (${userId}, ${name.trim()}, ${muscle_group || "other"})
    RETURNING *
  `
  return NextResponse.json(rows[0])
}