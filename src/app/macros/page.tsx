import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import MacrosClient from "@/components/MacrosClient"

export default async function MacrosPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [profile, todayFood, weightLogs] = await Promise.all([
    sql`SELECT * FROM profiles WHERE id = ${userId}`,
    sql`
      SELECT
        COALESCE(SUM(calories), 0) as calories,
        COALESCE(SUM(protein_g), 0) as protein,
        COALESCE(SUM(carbs_g), 0) as carbs,
        COALESCE(SUM(fat_g), 0) as fat
      FROM food_entries
      WHERE user_id = ${userId} AND log_date = CURRENT_DATE
    `,
    sql`
      SELECT weight_kg, log_date FROM weight_logs
      WHERE user_id = ${userId}
      ORDER BY log_date DESC
      LIMIT 90    `,
  ])

  return (
    <MacrosClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profile={profile[0] as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      todayFood={todayFood[0] as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      weightLogs={weightLogs as any[]}
    />
  )
}