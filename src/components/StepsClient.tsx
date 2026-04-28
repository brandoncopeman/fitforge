"use client"

import { useState } from "react"
import Link from "next/link"

type StepLog = {
  log_date: string
  steps: number
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function StepsClient({
  stepGoal,
  todaySteps: initialTodaySteps,
  logs: initialLogs,
  today,
}: {
  stepGoal: number
  todaySteps: number
  logs: StepLog[]
  today: string
}) {
  const [logs, setLogs] = useState<StepLog[]>(initialLogs)
  const [todaySteps, setTodaySteps] = useState(initialTodaySteps)
  const [goal, setGoal] = useState(stepGoal)
  const [editingSteps, setEditingSteps] = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [stepInput, setStepInput] = useState(String(initialTodaySteps))
  const [goalInput, setGoalInput] = useState(String(stepGoal))
  const [saving, setSaving] = useState(false)

  const progress = Math.min(100, Math.round((todaySteps / goal) * 100))

  // Get last 7 days for mini calendar
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - 6 + i)
    const dateStr = d.toISOString().split("T")[0]
    const log = logs.find(l => l.log_date?.toString().startsWith(dateStr))
    return {
      date: d,
      dateStr,
      steps: log?.steps || 0,
      isToday: dateStr === today,
    }
  })

  // Stats
  const bestDay = logs.reduce((best, log) => log.steps > (best?.steps || 0) ? log : best, logs[0])
  const avgSteps = logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + l.steps, 0) / logs.length)
    : 0
  const daysHitGoal = logs.filter(l => l.steps >= goal).length

  async function saveSteps() {
    setSaving(true)
    const steps = Number(stepInput) || 0
    setTodaySteps(steps)
    setLogs(prev => {
      const existing = prev.findIndex(l => l.log_date?.toString().startsWith(today))
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], steps }
        return updated
      }
      return [{ log_date: today, steps }, ...prev]
    })
    setEditingSteps(false)
    await fetch("/api/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps, log_date: today }),
    })
    setSaving(false)
  }

  async function saveGoal() {
    const newGoal = Number(goalInput) || 8000
    setGoal(newGoal)
    setEditingGoal(false)
    fetch("/api/steps/goal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_step_target: newGoal }),
    })
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 pb-24">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300">← Home</Link>
          <h1 className="text-2xl font-bold mt-1">Steps</h1>
        </div>

        {/* Today's progress */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 mb-4">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-neutral-400 text-sm mb-1">Today</p>
              {editingSteps ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={stepInput}
                    onChange={e => setStepInput(e.target.value)}
                    onFocus={e => e.target.select()}
                    className="w-32 bg-neutral-800 border border-teal-500 rounded-lg px-3 py-1.5 text-2xl font-bold focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={saveSteps}
                    disabled={saving}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingSteps(false)}
                    className="text-neutral-500 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditingSteps(true); setStepInput(String(todaySteps)) }}>
                  <p className="text-5xl font-bold text-white hover:text-teal-400 transition-colors">
                    {todaySteps.toLocaleString()}
                  </p>
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-neutral-400 text-sm">{progress}%</p>
              {editingGoal ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    className="w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-teal-500"
                    autoFocus
                  />
                  <button onClick={saveGoal} className="text-teal-400 text-xs">✓</button>
                  <button onClick={() => setEditingGoal(false)} className="text-neutral-500 text-xs">✕</button>
                </div>
              ) : (
                <button onClick={() => { setEditingGoal(true); setGoalInput(String(goal)) }}>
                  <p className="text-neutral-500 text-sm hover:text-neutral-300">
                    goal: {goal.toLocaleString()} ✎
                  </p>
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${progress >= 100 ? "bg-teal-400" : "bg-teal-600"}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-neutral-500 text-xs mt-2">
            {todaySteps >= goal
              ? "🎉 Goal reached!"
              : `${(goal - todaySteps).toLocaleString()} steps to go`}
          </p>

          <button
            onClick={() => { setEditingSteps(true); setStepInput(String(todaySteps)) }}
            className="mt-4 w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Log Today&apos;s Steps
          </button>
        </div>

        {/* Last 7 days */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 mb-4">
          <p className="text-sm font-medium mb-3">Last 7 Days</p>
          <div className="grid grid-cols-7 gap-1">
            {last7.map(({ date, steps, isToday }) => {
              const pct = Math.min(100, (steps / goal) * 100)
              return (
                <div key={date.toISOString()} className="flex flex-col items-center gap-1">
                  <span className={`text-xs ${isToday ? "text-teal-400 font-bold" : "text-neutral-500"}`}>
                    {DAYS[date.getDay()][0]}
                  </span>
                  <div className="w-full h-16 bg-neutral-800 rounded-lg overflow-hidden flex items-end">
                    <div
                      className={`w-full rounded-lg transition-all ${pct >= 100 ? "bg-teal-400" : "bg-teal-600"}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                  <span className={`text-xs ${isToday ? "text-teal-400" : "text-neutral-600"}`}>
                    {date.getDate()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 text-center">
            <p className="text-xl font-bold text-teal-400">{avgSteps.toLocaleString()}</p>
            <p className="text-neutral-500 text-xs mt-0.5">Daily avg</p>
          </div>
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 text-center">
            <p className="text-xl font-bold text-white">{daysHitGoal}</p>
            <p className="text-neutral-500 text-xs mt-0.5">Days hit goal</p>
          </div>
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 text-center">
            <p className="text-xl font-bold text-white">{bestDay?.steps?.toLocaleString() || 0}</p>
            <p className="text-neutral-500 text-xs mt-0.5">Best day</p>
          </div>
        </div>

        {/* Full history */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4">
          <p className="text-sm font-medium mb-3">History</p>
          <div className="space-y-0">
            {logs.slice(0, 14).map((log, i) => {
              const d = new Date(log.log_date)
              const pct = Math.min(100, Math.round((log.steps / goal) * 100))
              const isToday = log.log_date?.toString().startsWith(today)
              return (
                <div key={i} className="flex items-center gap-3 py-2.5 border-t border-neutral-800 first:border-0">
                  <div className="w-12 flex-shrink-0">
                    <p className={`text-xs font-medium ${isToday ? "text-teal-400" : "text-neutral-400"}`}>
                      {isToday ? "Today" : DAYS[d.getDay()]}
                    </p>
                    <p className="text-xs text-neutral-600">{MONTHS[d.getMonth()]} {d.getDate()}</p>
                  </div>
                  <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 100 ? "bg-teal-400" : "bg-teal-600"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-sm font-medium w-20 text-right ${pct >= 100 ? "text-teal-400" : "text-white"}`}>
                    {log.steps.toLocaleString()}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-neutral-600 text-xs text-center mt-4">
          Step tracking will be automatic when the mobile app launches
        </p>

      </div>
    </main>
  )
}