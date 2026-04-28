import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import sql from "@/lib/db"

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const templateRows = await sql`
    SELECT * FROM workout_templates WHERE id = ${id} AND user_id = ${userId}
  `
  if (templateRows.length === 0) redirect("/workouts")

  const template = templateRows[0]

  const exercises = await sql`
    SELECT * FROM template_exercises
    WHERE template_id = ${id}
    ORDER BY order_index ASC
  `

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <Link href="/workouts" className="text-neutral-500 text-sm hover:text-neutral-300">← Workouts</Link>
          <h1 className="text-2xl font-bold mt-1">{template.name}</h1>
          <p className="text-neutral-400 text-sm mt-0.5">{exercises.length} exercises</p>
        </div>

        {/* Start workout button */}
        <Link
          href={`/workouts/new?template=${id}`}
          className="block w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold text-center py-4 rounded-xl mb-6 transition-colors"
        >
          Start This Workout
        </Link>

        {/* Exercise list */}
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {exercises.map((exercise: any, idx: number) => (
            <div key={exercise.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0">
                <span className="text-neutral-400 text-xs">{idx + 1}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium capitalize">{exercise.exercise_name}</p>
                <p className="text-teal-400 text-xs capitalize mt-0.5">{exercise.muscle_group}</p>
              </div>
              <div className="text-right text-xs text-neutral-500">
                <p>{exercise.default_sets} sets</p>
                <p>{exercise.default_reps} reps</p>
                {exercise.default_weight_kg > 0 && <p>{exercise.default_weight_kg}kg</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Edit template link */}
        <Link
          href={`/workouts/templates/${id}`}
          className="block w-full mt-4 border border-neutral-700 text-neutral-400 hover:text-white text-center py-3 rounded-xl text-sm transition-colors"
        >
          Edit Template
        </Link>

      </div>
    </main>
  )
}