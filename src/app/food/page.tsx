import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import FoodTracker from "@/components/FoodTracker"

export default async function FoodPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const today = new Date().toISOString().split("T")[0]

  const [profile, entries, recentFoods, mealPlans] = await Promise.all([
    sql`SELECT daily_calorie_target, daily_protein_target FROM profiles WHERE id = ${userId}`,
    sql`SELECT * FROM food_entries WHERE user_id = ${userId} AND log_date = ${today} ORDER BY consumed_at ASC`,
    sql`SELECT * FROM recent_foods WHERE user_id = ${userId} ORDER BY last_used DESC LIMIT 10`,
    sql`
      SELECT mp.*, COALESCE(SUM(mpe.calories), 0) as total_calories
      FROM meal_plans mp
      LEFT JOIN meal_plan_entries mpe ON mpe.meal_plan_id = mp.id
      WHERE mp.user_id = ${userId}
      GROUP BY mp.id
      ORDER BY mp.created_at DESC
    `,
  ])

  return (
    <FoodTracker
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEntries={entries as any[]}
      calorieTarget={profile[0]?.daily_calorie_target || 2000}
      proteinTarget={profile[0]?.daily_protein_target || 150}
      today={today}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentFoods={recentFoods as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mealPlans={mealPlans as any[]}
    />
  )
}