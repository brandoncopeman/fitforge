import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import GoalsClient from "@/components/GoalsClient"

export default async function GoalsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const today = new Date().toISOString().split("T")[0]
  const monthStr = today.slice(0, 7)

  const [goals, completions] = await Promise.all([
    sql`SELECT * FROM goals WHERE user_id = ${userId} AND active = true ORDER BY order_index ASC`,
    sql`
      SELECT * FROM goal_completions
      WHERE user_id = ${userId}
        AND completed_date >= ${monthStr + '-01'}
    `,
  ])

  return (
    <GoalsClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialGoals={goals as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialCompletions={completions as any[]}
      today={today}
    />
  )
}