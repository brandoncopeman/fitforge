import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import sql from "@/lib/db"
import TemplateManager from "@/components/TemplateManager"

export default async function WorkoutsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const templates = await sql`
    SELECT 
      t.*,
      COUNT(te.id) as exercise_count
    FROM workout_templates t
    LEFT JOIN template_exercises te ON te.template_id = t.id
    WHERE t.user_id = ${userId}
    GROUP BY t.id
    ORDER BY t.plan_order ASC NULLS LAST, t.created_at DESC
  `

  const profile = await sql`SELECT last_plan_index FROM profiles WHERE id = ${userId}`
  const lastPlanIndex = profile[0]?.last_plan_index ?? -1

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300">← Home</Link>
            <h1 className="text-2xl font-bold mt-1">Workouts</h1>
          </div>
          <Link
            href="/workouts/history"
            className="text-neutral-400 hover:text-white text-sm border border-neutral-700 px-3 py-1.5 rounded-lg"
          >
            History
          </Link>
        </div>

        <TemplateManager
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialTemplates={templates as any[]}
          lastPlanIndex={lastPlanIndex}
        />
      </div>
    </main>
  )
}