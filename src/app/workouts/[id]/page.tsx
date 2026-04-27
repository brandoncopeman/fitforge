import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import sql from "@/lib/db"

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const workoutRows = await sql`
    SELECT * FROM workouts WHERE id = ${id} AND user_id = ${userId}
  `

  if (workoutRows.length === 0) redirect("/workouts")

  const workout = workoutRows[0]

  const exercises = await sql`
    SELECT * FROM workout_exercises
    WHERE workout_id = ${id}
    ORDER BY order_index ASC
  `

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exerciseIds = exercises.map((e: any) => e.id)

  const sets = exerciseIds.length > 0
    ? await sql`
        SELECT * FROM exercise_sets
        WHERE workout_exercise_id = ANY(${exerciseIds})
        ORDER BY set_number ASC
      `
    : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exercisesWithSets = exercises.map((exercise: any) => ({
    ...exercise,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sets: sets.filter((s: any) => s.workout_exercise_id === exercise.id),
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalVolume = sets.reduce((acc: number, set: any) => {
    return acc + (Number(set.weight_kg) * Number(set.reps))
  }, 0)

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
        <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300">
  ← Home
</Link>
          <h1 className="text-2xl font-bold mt-1">{workout.name}</h1>
          <p className="text-neutral-400 text-sm mt-1">
            {new Date(workout.performed_at).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3 text-center">
            <p className="text-2xl font-bold text-teal-400">{exercises.length}</p>
            <p className="text-neutral-400 text-xs mt-1">Exercises</p>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3 text-center">
            <p className="text-2xl font-bold text-teal-400">{sets.length}</p>
            <p className="text-neutral-400 text-xs mt-1">Total Sets</p>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3 text-center">
            <p className="text-2xl font-bold text-teal-400">
              {workout.duration_minutes ? `${workout.duration_minutes}m` : "—"}
            </p>
            <p className="text-neutral-400 text-xs mt-1">Duration</p>
          </div>
        </div>

        {totalVolume > 0 && (
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 mb-6">
            <p className="text-neutral-400 text-sm">Total Volume</p>
            <p className="text-3xl font-bold text-white mt-1">
              {totalVolume.toLocaleString()} <span className="text-lg text-neutral-400">kg</span>
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {exercisesWithSets.map((exercise: any) => (
            <div key={exercise.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
              <p className="font-semibold capitalize mb-0.5">{exercise.exercise_name}</p>
              <p className="text-teal-400 text-xs capitalize mb-3">{exercise.muscle_group}</p>

              {exercise.sets.length === 0 ? (
                <p className="text-neutral-500 text-sm">No sets logged</p>
              ) : (
                <div>
                  <div className="grid grid-cols-3 text-xs text-neutral-500 mb-2">
                    <span>Set</span>
                    <span>Weight</span>
                    <span>Reps</span>
                  </div>
                  {exercise.sets.map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (set: any) => (
                      <div key={set.id} className="grid grid-cols-3 text-sm py-1.5 border-t border-neutral-800">
                        <span className="text-neutral-400">{set.set_number}</span>
                        <span>{set.weight_kg} kg</span>
                        <span>{set.reps}</span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}