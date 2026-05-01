import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const favs = await sql`
    SELECT * FROM favourite_exercises
    WHERE user_id = ${userId}
    ORDER BY exercise_name ASC
  `
  return NextResponse.json(favs)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { exercise_name, muscle_group } = await req.json()

  const rows = await sql`
    INSERT INTO favourite_exercises (user_id, exercise_name, muscle_group)
    VALUES (${userId}, ${exercise_name}, ${muscle_group || "other"})
    ON CONFLICT (user_id, exercise_name) DO NOTHING
    RETURNING *
  `
  return NextResponse.json(rows[0] || { exercise_name, muscle_group })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const exercise_name = searchParams.get("name")

  await sql`DELETE FROM favourite_exercises WHERE user_id = ${userId} AND exercise_name = ${exercise_name}`
  return NextResponse.json({ success: true })
}