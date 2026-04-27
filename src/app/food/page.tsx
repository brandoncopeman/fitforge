import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import FoodTracker from "@/components/FoodTracker"

export default async function FoodPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const profile = await sql`SELECT daily_calorie_target, daily_protein_target FROM profiles WHERE id = ${userId}`
  const today = new Date().toISOString().split("T")[0]

  const entries = await sql`
    SELECT * FROM food_entries
    WHERE user_id = ${userId} AND log_date = ${today}
    ORDER BY consumed_at ASC
  `

  return (
    <FoodTracker
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEntries={entries as any[]}
      calorieTarget={profile[0]?.daily_calorie_target || 2000}
      proteinTarget={profile[0]?.daily_protein_target || 150}
      today={today}
    />
  )
}