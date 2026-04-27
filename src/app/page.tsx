import { UserButton } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { unstable_cache } from "next/cache"
import sql from "@/lib/db"
import Link from "next/link"

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default async function HomePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const getHomeData = unstable_cache(
    async (uid: string) => {
      const [profileRows, planTemplates, schedule, todayCalories] = await Promise.all([
        sql`SELECT * FROM profiles WHERE id = ${uid}`,
        sql`
          SELECT * FROM workout_templates
          WHERE user_id = ${uid} AND in_plan = true
          ORDER BY plan_order ASC
        `,
        sql`
          SELECT gs.day_of_week, gs.template_id, wt.name as template_name
          FROM gym_schedule gs
          LEFT JOIN workout_templates wt ON gs.template_id = wt.id
          WHERE gs.user_id = ${uid}
        `,
        sql`
          SELECT COALESCE(SUM(calories), 0) as total
          FROM food_entries
          WHERE user_id = ${uid} AND log_date = CURRENT_DATE
        `,
      ])
      return { profileRows, planTemplates, schedule, todayCalories }
    },
    [`home-${userId}`],
    { revalidate: 60 } // cache for 60 seconds
  )

  const { profileRows, planTemplates, schedule, todayCalories } = await getHomeData(userId!)

  const profile = profileRows[0]

  if (!profile || !profile.weight_kg || !profile.goal) {
    redirect("/onboarding")
  }

  const lastPlanIndex = profile.last_plan_index ?? -1
  const nextPlanIndex = planTemplates.length > 0
    ? (lastPlanIndex + 1) % planTemplates.length
    : -1
  const nextTemplate = nextPlanIndex >= 0 ? planTemplates[nextPlanIndex] : null
  const caloriesConsumed = Math.round(Number(todayCalories[0]?.total || 0))
  const today = new Date()
  const todayDow = today.getDay()

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">FitForge</h1>
          <UserButton />
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6 mb-4">
          <h2 className="text-xl font-semibold mb-1">
            Welcome back, {profile.display_name || "there"}!
          </h2>
          <p className="text-neutral-400 text-sm">Here&apos;s your daily targets:</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Link
            href="/food"
            className="bg-neutral-900 rounded-lg border border-neutral-800 p-5 hover:border-teal-700 transition-colors block"
          >
            <p className="text-neutral-400 text-sm mb-1">Daily Calories</p>
            <p className="text-3xl font-bold text-teal-400">{caloriesConsumed}</p>
            <p className="text-neutral-500 text-xs mt-1">of {profile.daily_calorie_target} kcal</p>
          </Link>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5">
            <p className="text-neutral-400 text-sm mb-1">Daily Protein</p>
            <p className="text-3xl font-bold text-teal-400">{profile.daily_protein_target}g</p>
            <p className="text-neutral-500 text-xs mt-1">protein target</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5">
            <p className="text-neutral-400 text-sm mb-1">Daily Steps</p>
            <p className="text-3xl font-bold text-white">{profile.daily_step_target?.toLocaleString()}</p>
            <p className="text-neutral-500 text-xs mt-1">step goal</p>
          </div>

          <Link
            href="/schedule"
            className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 hover:border-teal-700 transition-colors block"
          >
            <p className="text-neutral-400 text-sm mb-2">This Week</p>
            <div className="grid grid-cols-7 gap-0.5">
              {DAYS_SHORT.map((day, i) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const schedDay = (schedule as any[]).find((s: any) => s.day_of_week === i)
                const isGym = !!schedDay
                const isToday = i === todayDow
                return (
                  <div key={i} className="flex flex-col items-center">
                    <span className={`text-xs font-medium mb-0.5 ${isToday ? "font-bold text-teal-400" : "text-neutral-400"}`}>
                      {day[0]}
                    </span>
                    <div className={`w-full aspect-square rounded flex items-center justify-center ${
                      isGym ? "bg-teal-600" : "bg-neutral-800"
                    } ${isToday ? "ring-1 ring-teal-400" : ""}`}>
                      {isGym && schedDay?.template_name && (
                        <div className="w-1 h-1 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-neutral-500 text-xs mt-2">Tap to edit schedule</p>
          </Link>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Link
            href="/workouts"
            className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 hover:border-teal-700 transition-colors block"
          >
            <p className="text-lg font-semibold">Workouts</p>
            <p className="text-neutral-400 text-sm mt-1">Templates & history</p>
          </Link>

          <Link
            href="/stats"
            className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 hover:border-teal-700 transition-colors block"
          >
            <p className="text-lg font-semibold">Stats</p>
            <p className="text-neutral-400 text-sm mt-1">Progress & records</p>
          </Link>

          <Link
            href={nextTemplate ? `/workouts/new?template=${nextTemplate.id}` : "/workouts/new"}
            className="bg-teal-600/10 border border-teal-700/50 hover:bg-teal-600/20 rounded-lg p-4 transition-colors block col-span-2"
          >
            <p className="text-xs text-teal-400 font-medium mb-0.5">
              {nextTemplate ? "Next in your plan" : "No plan set up"}
            </p>
            <p className="text-white font-semibold">
              {nextTemplate ? nextTemplate.name : "Empty Workout"}
            </p>
            <p className="text-neutral-400 text-xs mt-1">
              {nextTemplate ? `${nextTemplate.exercise_count ?? ""} exercises` : "Start a free session"}
            </p>
          </Link>
        </div>

      </div>
    </main>
  )
}