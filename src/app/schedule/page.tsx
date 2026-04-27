import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import ScheduleEditor from "@/components/ScheduleEditor"

export default async function SchedulePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const schedule = await sql`
    SELECT gs.*, wt.name as template_name
    FROM gym_schedule gs
    LEFT JOIN workout_templates wt ON gs.template_id = wt.id
    WHERE gs.user_id = ${userId}
  `

  const templates = await sql`
    SELECT id, name FROM workout_templates
    WHERE user_id = ${userId}
    ORDER BY in_plan DESC, plan_order ASC NULLS LAST, name ASC
  `

  return (
    <ScheduleEditor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialSchedule={schedule as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      templates={templates as any[]}
    />
  )
}