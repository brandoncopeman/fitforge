import { UserButton } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"

export default async function HomePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  // Check if the user has completed onboarding
  const rows = await sql`
    SELECT * FROM profiles WHERE id = ${userId}
  `

  const profile = rows[0]

  // If no profile or missing key fields, send them to onboarding
  if (!profile || !profile.weight_kg || !profile.goal) {
    redirect("/onboarding")
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">FitForge</h1>
          <UserButton />
        </div>

        {/* Welcome card */}
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6 mb-4">
          <h2 className="text-xl font-semibold mb-1">
            Welcome back, {profile.display_name || "there"}!
          </h2>
          <p className="text-neutral-400 text-sm">Here&apos;s your daily targets:</p>
        </div>

        {/* Targets row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5">
            <p className="text-neutral-400 text-sm mb-1">Daily Calories</p>
            <p className="text-3xl font-bold text-teal-400">{profile.daily_calorie_target}</p>
            <p className="text-neutral-500 text-xs mt-1">kcal target</p>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5">
            <p className="text-neutral-400 text-sm mb-1">Daily Protein</p>
            <p className="text-3xl font-bold text-teal-400">{profile.daily_protein_target}g</p>
            <p className="text-neutral-500 text-xs mt-1">protein target</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5">
            <p className="text-neutral-400 text-sm mb-1">Daily Steps</p>
            <p className="text-3xl font-bold text-white">{profile.daily_step_target?.toLocaleString()}</p>
            <p className="text-neutral-500 text-xs mt-1">step goal</p>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5">
            <p className="text-neutral-400 text-sm mb-1">Weekly Workouts</p>
            <p className="text-3xl font-bold text-white">{profile.weekly_workout_target}</p>
            <p className="text-neutral-500 text-xs mt-1">sessions/week</p>
          </div>
        </div>

      </div>
    </main>
  )
}