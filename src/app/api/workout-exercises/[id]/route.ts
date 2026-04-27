import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

// DELETE — remove an exercise from a workout
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { id } = await params

  // Only delete if it belongs to this user (via workout ownership)
  await sql`
    DELETE FROM workout_exercises we
    USING workouts w
    WHERE we.id = ${id}
      AND we.workout_id = w.id
      AND w.user_id = ${userId}
  `

  return NextResponse.json({ success: true })
}