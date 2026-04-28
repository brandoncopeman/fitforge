import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import sql from "@/lib/db"
import WorkoutHistory from "@/components/WorkoutHistory"

export default async function WorkoutHistoryPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const workouts = await sql`
    SELECT w.id, w.name, w.performed_at, w.duration_minutes, COUNT(we.id) as exercise_count
    FROM workouts w
    LEFT JOIN workout_exercises we ON we.workout_id = w.id
    WHERE w.user_id = ${userId}
    GROUP BY w.id
    ORDER BY w.performed_at DESC
    LIMIT 50
  `

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/workouts" className="text-neutral-500 text-sm hover:text-neutral-300">← Workouts</Link>
          <h1 className="text-2xl font-bold mt-1">Workout History</h1>
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <WorkoutHistory initialWorkouts={workouts as any[]} />
      </div>
    </main>
  )
}