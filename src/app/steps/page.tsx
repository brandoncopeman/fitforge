import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import StepsClient from "@/components/StepsClient"

export default async function StepsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [profile, stepLogs] = await Promise.all([
    sql`SELECT daily_step_target FROM profiles WHERE id = ${userId}`,
    sql`
      SELECT * FROM step_logs
      WHERE user_id = ${userId}
      ORDER BY log_date DESC
      LIMIT 30
    `,
  ])

  const today = new Date().toISOString().split("T")[0]
  const todayLog = stepLogs.find((s: any) => s.log_date?.toString().startsWith(today))

  return (
    <StepsClient
      stepGoal={profile[0]?.daily_step_target || 8000}
      todaySteps={todayLog?.steps || 0}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logs={stepLogs as any[]}
      today={today}
    />
  )
}