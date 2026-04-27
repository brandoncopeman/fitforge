import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import sql from "@/lib/db"

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

        {workouts.length === 0 ? (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 text-center">
            <p className="text-neutral-400">No workouts logged yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {workouts.map((workout: any) => (
              <Link key={workout.id} href={`/workouts/${workout.id}`}
                className="block bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-neutral-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{workout.name}</p>
                    <p className="text-neutral-400 text-sm mt-0.5">
                      {new Date(workout.performed_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-neutral-300 text-sm">{workout.exercise_count} exercises</p>
                    {workout.duration_minutes && <p className="text-neutral-500 text-xs mt-0.5">{workout.duration_minutes} min</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}