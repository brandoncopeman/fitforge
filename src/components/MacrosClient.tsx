"use client"

import { useState } from "react"
import Link from "next/link"

type Profile = {
  display_name: string
  weight_kg: number
  height_cm: number
  age: number
  sex: string
  activity_level: string
  goal: string
  daily_calorie_target: number
  daily_protein_target: number
  show_weight_on_home: boolean
  goal_weight_kg: number | null
}

type TodayFood = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", desc: "Little or no exercise" },
  { value: "light", label: "Lightly Active", desc: "1–3 days/week" },
  { value: "moderate", label: "Moderately Active", desc: "3–5 days/week" },
  { value: "active", label: "Very Active", desc: "6–7 days/week" },
  { value: "very_active", label: "Extremely Active", desc: "Hard daily exercise" },
]

const GOALS = [
  { value: "cut", label: "Lose Weight", desc: "−500 kcal/day" },
  { value: "maintain", label: "Maintain", desc: "At maintenance" },
  { value: "bulk", label: "Build Muscle", desc: "+300 kcal/day" },
]

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function calculateTDEE(weight: number, height: number, age: number, sex: string, activity: string, goal: string) {
  const activityMap: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9
  }
  const bmr = sex === "male"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161

  const tdee = bmr * (activityMap[activity] || 1.55)
  const goalMap: Record<string, number> = { cut: -500, maintain: 0, bulk: 300 }
  const calories = Math.round(tdee + (goalMap[goal] || 0))
  const protein = Math.round(weight * 1.6)
  const fat = Math.round((calories * 0.25) / 9)
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4)

  return { calories, protein, carbs, fat, tdee: Math.round(tdee) }
}

function estimateWeeksToGoal(currentKg: number, goalKg: number, caloricDiff: number): number | null {
  if (!currentKg || !goalKg || currentKg === goalKg) return null
  const weeklyDeficit = Math.abs(caloricDiff) * 7
  const kgToChange = Math.abs(currentKg - goalKg)
  if (weeklyDeficit === 0) return null
  return Math.round((kgToChange * 7700) / weeklyDeficit)
}

export default function MacrosClient({
  profile,
  todayFood,
  weightLogs: initialWeightLogs,
}: {
  profile: Profile
  todayFood: TodayFood
  weightLogs: { weight_kg: number; log_date: string }[]
}) {
  const [showRecalc, setShowRecalc] = useState(false)
  const [weight, setWeight] = useState(String(profile.weight_kg))
  const [height, setHeight] = useState(String(profile.height_cm))
  const [age, setAge] = useState(String(profile.age))
  const [sex, setSex] = useState(profile.sex)
  const [activity, setActivity] = useState(profile.activity_level)
  const [goal, setGoal] = useState(profile.goal)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [weightLogs, setWeightLogs] = useState(initialWeightLogs)
  const [weightInput, setWeightInput] = useState("")
  const [showWeightOnHome, setShowWeightOnHome] = useState(profile.show_weight_on_home || false)
  const [savingWeight, setSavingWeight] = useState(false)
  const [goalWeight, setGoalWeight] = useState(String(profile.goal_weight_kg || ""))
  const [editingGoalWeight, setEditingGoalWeight] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const latestWeight = weightLogs[0]?.weight_kg || null
  const startWeight = weightLogs[weightLogs.length - 1]?.weight_kg || null
  const weightChange = latestWeight && startWeight ? Number(latestWeight) - Number(startWeight) : null

  const current = calculateTDEE(
    profile.weight_kg, profile.height_cm, profile.age,
    profile.sex, profile.activity_level, profile.goal
  )

  const preview = showRecalc ? calculateTDEE(
    Number(weight), Number(height), Number(age), sex, activity, goal
  ) : null

  const today = {
    calories: Math.round(Number(todayFood.calories)),
    protein: Math.round(Number(todayFood.protein)),
    carbs: Math.round(Number(todayFood.carbs)),
    fat: Math.round(Number(todayFood.fat)),
  }

  const caloricDiff = current.calories - current.tdee
  const todayStr = new Date().toISOString().split("T")[0]

  // Build calendar data
  const calendarDays = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const log = weightLogs.find(l => l.log_date?.toString().startsWith(dateStr))
      days.push({ day: d, dateStr, weight: log?.weight_kg || null })
    }

    return days
  }

  async function saveRecalc() {
    setSaving(true)
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: profile.display_name,
        weight_kg: Number(weight),
        height_cm: Number(height),
        age: Number(age),
        sex,
        activity_level: activity,
        goal,
      }),
    })
    setSaving(false)
    setSaved(true)
    setShowRecalc(false)
    setTimeout(() => window.location.reload(), 500)
  }

  async function logWeight() {
    if (!weightInput) return
    setSavingWeight(true)
    const w = Number(weightInput)

    setWeightLogs(prev => {
      const existing = prev.findIndex(l => l.log_date?.toString().startsWith(todayStr))
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], weight_kg: w }
        return updated
      }
      return [{ weight_kg: w, log_date: todayStr }, ...prev]
    })
    setWeightInput("")

    await fetch("/api/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_kg: w }),
    })
    setSavingWeight(false)
  }

  async function toggleWeightOnHome() {
    const newVal = !showWeightOnHome
    setShowWeightOnHome(newVal)
    fetch("/api/profile/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_weight_on_home: newVal }),
    })
  }

  async function saveGoalWeight() {
    setEditingGoalWeight(false)
    fetch("/api/profile/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_weight_kg: Number(goalWeight) }),
    })
  }

  const days = calendarDays()
  const allWeights = weightLogs.map(l => Number(l.weight_kg)).filter(Boolean)
  const minWeight = allWeights.length ? Math.min(...allWeights) : 0
  const maxWeight = allWeights.length ? Math.max(...allWeights) : 0

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 pb-24">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300">← Home</Link>
          <h1 className="text-2xl font-bold mt-1">Macros & TDEE</h1>
        </div>

        {saved && (
          <div className="bg-teal-600/20 border border-teal-700 rounded-xl p-3 mb-4 text-teal-400 text-sm text-center">
            Targets updated successfully!
          </div>
        )}

        {/* Today's macros */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 mb-4">
          <p className="text-sm font-medium text-neutral-400 mb-4">Today&apos;s Intake</p>

          <div className="mb-4">
            <div className="flex items-end justify-between mb-1.5">
              <p className="text-sm text-neutral-400">Calories</p>
              <p className="text-sm text-neutral-400">{today.calories} / {profile.daily_calorie_target} kcal</p>
            </div>
            <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-2.5 rounded-full ${today.calories > profile.daily_calorie_target ? "bg-red-500" : "bg-teal-500"}`}
                style={{ width: `${Math.min(100, (today.calories / profile.daily_calorie_target) * 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Protein", current: today.protein, target: profile.daily_protein_target, color: "bg-blue-500" },
              { label: "Carbs", current: today.carbs, target: current.carbs, color: "bg-yellow-500" },
              { label: "Fat", current: today.fat, target: current.fat, color: "bg-orange-500" },
            ].map(({ label, current: cur, target, color }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <p className="text-xs text-neutral-500">{label}</p>
                  <p className="text-xs text-neutral-500">{cur}/{target}g</p>
                </div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, (cur / target) * 100)}%` }} />
                </div>
                <p className="text-lg font-bold text-white mt-1">{cur}<span className="text-xs text-neutral-500">g</span></p>
              </div>
            ))}
          </div>
        </div>

        {/* TDEE breakdown */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 mb-4">
          <p className="text-sm font-medium text-neutral-400 mb-4">Your TDEE Breakdown</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-neutral-800 rounded-xl p-3">
              <p className="text-xs text-neutral-500">Maintenance</p>
              <p className="text-2xl font-bold text-white">{current.tdee}</p>
              <p className="text-xs text-neutral-500">kcal/day</p>
            </div>
            <div className="bg-neutral-800 rounded-xl p-3">
              <p className="text-xs text-neutral-500">Your Target</p>
              <p className="text-2xl font-bold text-teal-400">{current.calories}</p>
              <p className="text-xs text-neutral-500">kcal/day</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-neutral-800 rounded-lg p-2">
              <p className="text-blue-400 font-bold">{current.protein}g</p>
              <p className="text-xs text-neutral-500">Protein</p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-2">
              <p className="text-yellow-400 font-bold">{current.carbs}g</p>
              <p className="text-xs text-neutral-500">Carbs</p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-2">
              <p className="text-orange-400 font-bold">{current.fat}g</p>
              <p className="text-xs text-neutral-500">Fat</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-neutral-800 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Goal</span>
              <span className="capitalize text-neutral-300">{profile.goal === "cut" ? "Lose Weight" : profile.goal === "bulk" ? "Build Muscle" : "Maintain"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Activity</span>
              <span className="capitalize text-neutral-300">{ACTIVITY_LEVELS.find(a => a.value === profile.activity_level)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Body weight</span>
              <span className="text-neutral-300">{profile.weight_kg}kg</span>
            </div>
          </div>
        </div>

        {/* Weight Tracking */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium">Weight Tracking</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Show on home</span>
              <button
                onClick={toggleWeightOnHome}
                className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${showWeightOnHome ? "bg-teal-600" : "bg-neutral-700"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${showWeightOnHome ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Log weight */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <p className="text-xs text-neutral-500 mb-1">Current weight</p>
              <p className="text-3xl font-bold text-white">
                {latestWeight ? `${latestWeight}` : "—"}
                {latestWeight && <span className="text-lg text-neutral-400">kg</span>}
              </p>
              {weightChange !== null && (
                <p className={`text-xs mt-0.5 ${weightChange < 0 ? "text-teal-400" : weightChange > 0 ? "text-red-400" : "text-neutral-500"}`}>
                  {weightChange > 0 ? "+" : ""}{Number(weightChange).toFixed(1)}kg from start
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="kg"
                className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              />
              <button
                onClick={logWeight}
                disabled={!weightInput || savingWeight}
                className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm"
              >
                Log
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="text-neutral-400 hover:text-white px-2 py-1 rounded text-sm"
              >
                ‹
              </button>
              <p className="text-sm font-medium">
                {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </p>
              <button
                onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="text-neutral-400 hover:text-white px-2 py-1 rounded text-sm"
                disabled={calendarMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
              >
                ›
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map(d => (
                <p key={d} className="text-xs text-neutral-600 text-center">{d[0]}</p>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />
                const isToday = day.dateStr === todayStr
                const hasWeight = day.weight !== null
                const weightNum = Number(day.weight)

                // Color intensity based on weight relative to min/max
                let dotColor = "bg-neutral-700"
                if (hasWeight && maxWeight > minWeight) {
                  const ratio = (weightNum - minWeight) / (maxWeight - minWeight)
                  if (profile.goal === "cut") {
                    dotColor = ratio < 0.33 ? "bg-teal-400" : ratio < 0.66 ? "bg-teal-600" : "bg-orange-500"
                  } else if (profile.goal === "bulk") {
                    dotColor = ratio > 0.66 ? "bg-teal-400" : ratio > 0.33 ? "bg-teal-600" : "bg-orange-500"
                  } else {
                    dotColor = "bg-teal-500"
                  }
                }

                return (
                  <div
                    key={day.dateStr}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center relative ${
                      isToday ? "ring-1 ring-teal-400" : ""
                    } ${hasWeight ? dotColor : "bg-neutral-800"}`}
                  >
                    <span className={`text-xs font-medium ${hasWeight ? "text-white" : isToday ? "text-teal-400" : "text-neutral-500"}`}>
                      {day.day}
                    </span>
                    {hasWeight && (
                      <span className="text-white" style={{ fontSize: "8px" }}>
                        {weightNum}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-3 mt-2 justify-center">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                <span className="text-xs text-neutral-500">{profile.goal === "cut" ? "Lower" : "Higher"}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-neutral-700" />
                <span className="text-xs text-neutral-500">No log</span>
              </div>
            </div>
          </div>

          {/* Recent weight history */}
          {weightLogs.length > 0 && (
            <div className="space-y-0 mb-4">
              <p className="text-xs text-neutral-500 mb-2">Recent</p>
              {weightLogs.slice(0, 5).map((log, i) => {
                const d = new Date(log.log_date)
                const isToday = log.log_date?.toString().startsWith(todayStr)
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-t border-neutral-800 first:border-0">
                    <p className={`text-sm ${isToday ? "text-teal-400" : "text-neutral-400"}`}>
                      {isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <p className="text-sm font-medium">{log.weight_kg}kg</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Goal weight */}
          <div className="pt-3 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-neutral-500 font-medium">Goal Weight</p>
              <button
                onClick={() => setEditingGoalWeight(!editingGoalWeight)}
                className="text-xs text-teal-400 hover:text-teal-300"
              >
                {editingGoalWeight ? "Cancel" : goalWeight ? "Edit" : "Set Goal"}
              </button>
            </div>

            {editingGoalWeight ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={goalWeight}
                  onChange={e => setGoalWeight(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="kg"
                  autoFocus
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
                <button onClick={saveGoalWeight} className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg text-sm">Save</button>
              </div>
            ) : goalWeight ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold text-lg">{goalWeight}kg</p>
                  {latestWeight && (
                    <p className={`text-sm font-medium ${Number(latestWeight) > Number(goalWeight) ? "text-orange-400" : "text-teal-400"}`}>
                      {Math.abs(Number(latestWeight) - Number(goalWeight)).toFixed(1)}kg to go
                    </p>
                  )}
                </div>

                {latestWeight && (() => {
                  const weeks = estimateWeeksToGoal(Number(latestWeight), Number(goalWeight), caloricDiff)
                  if (!weeks) return null
                  const months = Math.floor(weeks / 4.33)
                  const remWeeks = Math.round(weeks % 4.33)
                  const timeStr = months > 0
                    ? `~${months} month${months > 1 ? "s" : ""}${remWeeks > 0 ? ` ${remWeeks}wk` : ""}`
                    : `~${weeks} week${weeks > 1 ? "s" : ""}`
                  const eta = new Date()
                  eta.setDate(eta.getDate() + weeks * 7)
                  return (
                    <div className="bg-neutral-800 rounded-xl p-3">
                      <p className="text-xs text-neutral-500 mb-1">Estimated time at current deficit</p>
                      <p className="text-teal-400 font-bold">{timeStr}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Est. {eta.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <p className="text-neutral-600 text-xs">No goal weight set</p>
            )}
          </div>
        </div>

        {/* Recalculate */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Recalibrate Targets</p>
            <button onClick={() => setShowRecalc(!showRecalc)} className="text-teal-400 hover:text-teal-300 text-sm">
              {showRecalc ? "Cancel" : "Update"}
            </button>
          </div>

          {showRecalc && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Weight (kg)</label>
                  <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Height (cm)</label>
                  <input type="number" value={height} onChange={e => setHeight(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Age</label>
                  <input type="number" value={age} onChange={e => setAge(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Sex</label>
                  <select value={sex} onChange={e => setSex(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Activity Level</label>
                <div className="space-y-1">
                  {ACTIVITY_LEVELS.map(a => (
                    <button key={a.value} onClick={() => setActivity(a.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activity === a.value ? "bg-teal-600/20 border border-teal-500 text-white" : "bg-neutral-800 text-neutral-400"
                      }`}>
                      {a.label} <span className="text-xs text-neutral-500">— {a.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Goal</label>
                <div className="grid grid-cols-3 gap-2">
                  {GOALS.map(g => (
                    <button key={g.value} onClick={() => setGoal(g.value)}
                      className={`py-2 px-2 rounded-lg text-xs text-center transition-colors ${
                        goal === g.value ? "bg-teal-600 text-white" : "bg-neutral-800 text-neutral-400"
                      }`}>
                      <p className="font-medium">{g.label}</p>
                      <p className="text-neutral-400 text-xs">{g.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {preview && (
                <div className="bg-neutral-800 rounded-xl p-3 text-sm">
                  <p className="text-neutral-400 text-xs mb-2">New targets preview:</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="font-bold text-teal-400">{preview.calories}</p>
                      <p className="text-xs text-neutral-500">kcal</p>
                    </div>
                    <div>
                      <p className="font-bold text-blue-400">{preview.protein}g</p>
                      <p className="text-xs text-neutral-500">protein</p>
                    </div>
                    <div>
                      <p className="font-bold text-yellow-400">{preview.carbs}g</p>
                      <p className="text-xs text-neutral-500">carbs</p>
                    </div>
                    <div>
                      <p className="font-bold text-orange-400">{preview.fat}g</p>
                      <p className="text-xs text-neutral-500">fat</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={saveRecalc}
                disabled={saving}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
              >
                {saving ? "Saving..." : "Save New Targets"}
              </button>
            </div>
          )}

          {!showRecalc && (
            <p className="text-neutral-500 text-xs">Update your stats to recalculate your daily calorie and macro targets.</p>
          )}
        </div>

      </div>
    </main>
  )
}