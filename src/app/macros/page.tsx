import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import MacrosClient from "@/components/MacrosClient"

export default async function MacrosPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [profile, todayFood] = await Promise.all([
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
  ])

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <MacrosClient profile={profile[0] as any} todayFood={todayFood[0] as any} />
  )
}