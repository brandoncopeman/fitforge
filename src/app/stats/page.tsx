import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import sql from "@/lib/db"
import StatsClient from "@/components/StatsClient"

export default async function StatsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  // All workouts
  const workouts = await sql`
    SELECT id, name, performed_at, duration_minutes
    FROM workouts
    WHERE user_id = ${userId}
    ORDER BY performed_at DESC
  `

  // Total sets and volume
  const volumeStats = await sql`
    SELECT 
      w.performed_at,
      SUM(es.weight_kg * es.reps) as volume,
      COUNT(es.id) as total_sets
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
    JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ${userId}
    GROUP BY w.id, w.performed_at
    ORDER BY w.performed_at ASC
  `

  // Personal records (heaviest set per exercise)
  const personalRecords = await sql`
    SELECT 
      we.exercise_name,
      we.muscle_group,
      MAX(es.weight_kg) as max_weight,
      MAX(es.reps) as reps_at_max,
      MAX(w.performed_at) as last_performed
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
    JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ${userId}
      AND es.weight_kg > 0
    GROUP BY we.exercise_name, we.muscle_group
    ORDER BY max_weight DESC
    LIMIT 20
  `

  // 1RM per exercise (Epley formula: weight * (1 + reps/30))
  const oneRepMaxes = await sql`
    SELECT 
      we.exercise_name,
      we.muscle_group,
      MAX(es.weight_kg * (1 + es.reps::numeric / 30)) as estimated_1rm,
      es.weight_kg as best_weight,
      es.reps as best_reps
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
    JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ${userId}
      AND es.weight_kg > 0
      AND es.reps > 0
    GROUP BY we.exercise_name, we.muscle_group, es.weight_kg, es.reps
    ORDER BY estimated_1rm DESC
    LIMIT 20
  `

  // Most trained muscle groups
  const muscleGroups = await sql`
    SELECT 
      we.muscle_group,
      COUNT(es.id) as total_sets
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
    JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ${userId}
      AND we.muscle_group IS NOT NULL
    GROUP BY we.muscle_group
    ORDER BY total_sets DESC
    LIMIT 10
  `

  // Weekly volume (last 12 weeks)
  const weeklyVolume = await sql`
    SELECT 
      DATE_TRUNC('week', w.performed_at) as week,
      SUM(es.weight_kg * es.reps) as volume,
      COUNT(DISTINCT w.id) as workout_count
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
    JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ${userId}
      AND w.performed_at > NOW() - INTERVAL '12 weeks'
    GROUP BY DATE_TRUNC('week', w.performed_at)
    ORDER BY week ASC
  `

  // All time totals
  const totals = await sql`
    SELECT
      COUNT(DISTINCT w.id) as total_workouts,
      COALESCE(SUM(es.weight_kg * es.reps), 0) as total_volume,
      COUNT(es.id) as total_sets,
      COALESCE(SUM(w.duration_minutes), 0) as total_minutes
    FROM workouts w
    LEFT JOIN workout_exercises we ON we.workout_id = w.id
    LEFT JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ${userId}
  `

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300">← Home</Link>
          <h1 className="text-2xl font-bold mt-1">Stats</h1>
        </div>

        <StatsClient
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          workouts={workouts as any[]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          volumeStats={volumeStats as any[]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personalRecords={personalRecords as any[]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oneRepMaxes={oneRepMaxes as any[]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          muscleGroups={muscleGroups as any[]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          weeklyVolume={weeklyVolume as any[]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totals={totals[0] as any}
        />
      </div>
    </main>
  )
}
