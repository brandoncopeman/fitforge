import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import TemplateEditor from "@/components/TemplateEditor"

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const rows = await sql`SELECT * FROM workout_templates WHERE id = ${id} AND user_id = ${userId}`
  if (rows.length === 0) redirect("/workouts")

  const exercises = await sql`
    SELECT * FROM template_exercises WHERE template_id = ${id} ORDER BY order_index ASC
  `

  return (
    <TemplateEditor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      template={rows[0] as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialExercises={exercises as any[]}
    />
  )
}