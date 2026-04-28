import { auth } from "@clerk/nextjs/server"
import sql from "@/lib/db"
import BottomNavClient from "./BottomNavClient"

export default async function BottomNav() {
  const { userId } = await auth()
  if (!userId) return null

  const [profile, planTemplates] = await Promise.all([
    sql`SELECT nav_items, last_plan_index FROM profiles WHERE id = ${userId}`,
    sql`
      SELECT id FROM workout_templates
      WHERE user_id = ${userId} AND in_plan = true
      ORDER BY plan_order ASC
    `,
  ])

  const navItems = profile[0]?.nav_items || ["workouts", "quickstart", "food"]
  const lastPlanIndex = profile[0]?.last_plan_index ?? -1

  const nextPlanIndex = planTemplates.length > 0
    ? (lastPlanIndex + 1) % planTemplates.length
    : -1
  const nextTemplateId = nextPlanIndex >= 0 ? planTemplates[nextPlanIndex]?.id : null

  return (
    <BottomNavClient
      navItems={navItems}
      nextTemplateId={nextTemplateId}
    />
  )
}