import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

// GET — fetch all workouts for the logged-in user
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const workouts = await sql`
    SELECT 
      w.id,
      w.name,
      w.performed_at,
      w.duration_minutes,
      w.notes,
      COUNT(we.id) as exercise_count
    FROM workouts w
    LEFT JOIN workout_exercises we ON we.workout_id = w.id
    WHERE w.user_id = ${userId}
    GROUP BY w.id
    ORDER BY w.performed_at DESC
    LIMIT 50
  `

  return NextResponse.json(workouts)
}

// POST — create a new workout
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const body = await req.json()
  const { name } = body

  const rows = await sql`
    INSERT INTO workouts (user_id, name)
    VALUES (${userId}, ${name || "Workout"})
    RETURNING *
  `

  return NextResponse.json(rows[0])
}