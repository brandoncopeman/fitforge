"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

type ScheduleDay = {
  day_of_week: number
  template_id: string | null
  template_name: string | null
}

type Template = {
  id: string
  name: string
}

export default function ScheduleEditor({
  initialSchedule,
  templates,
}: {
  initialSchedule: ScheduleDay[]
  templates: Template[]
}) {
  const router = useRouter()
  const [schedule, setSchedule] = useState<ScheduleDay[]>(initialSchedule)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Get today and the current week's dates
  const today = new Date()
  const currentDayOfWeek = today.getDay()
  const weekDates = DAYS.map((_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - currentDayOfWeek + i)
    return d
  })

  function getScheduleDay(dayOfWeek: number) {
    return schedule.find(s => s.day_of_week === dayOfWeek) || null
  }

  function isGymDay(dayOfWeek: number) {
    return !!getScheduleDay(dayOfWeek)
  }

  async function toggleDay(dayOfWeek: number) {
    // If clicking already selected day, just deselect it
    if (selectedDay === dayOfWeek && isGymDay(dayOfWeek)) {
      setSelectedDay(null)
      return
    }
  
    // If it's a gym day but not selected, just select it
    if (isGymDay(dayOfWeek)) {
      setSelectedDay(dayOfWeek)
      return
    }
  
    // Otherwise toggle off
    setSaving(true)
    if (isGymDay(dayOfWeek)) {
      await fetch("/api/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_of_week: dayOfWeek }),
      })
      setSchedule(prev => prev.filter(s => s.day_of_week !== dayOfWeek))
      setSelectedDay(null)
    } else {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_of_week: dayOfWeek, template_id: null }),
      })
      const data = await res.json()
      setSchedule(prev => [...prev, { ...data, template_name: null }])
      setSelectedDay(dayOfWeek)
    }
    setSaving(false)
    router.refresh()
  }

  async function assignTemplate(dayOfWeek: number, templateId: string | null) {
    setSaving(true)
    const template = templates.find(t => t.id === templateId)
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_of_week: dayOfWeek, template_id: templateId }),
    })
    await res.json()
    setSchedule(prev => prev.map(s =>
      s.day_of_week === dayOfWeek
        ? { ...s, template_id: templateId, template_name: template?.name || null }
        : s
    ))
    setSaving(false)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300">← Home</Link>
          <h1 className="text-2xl font-bold mt-1">Weekly Schedule</h1>
          <p className="text-neutral-400 text-sm mt-1">Tap a day to mark it as a gym day</p>
        </div>

        {/* Weekly calendar */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {DAYS.map((day, i) => {
            const isGym = isGymDay(i)
            const isToday = i === currentDayOfWeek
            const date = weekDates[i]

            return (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                disabled={saving}
                className={`flex flex-col items-center p-3 rounded-xl border transition-colors ${
                  isGym
                    ? "bg-teal-600/20 border-teal-500 text-white"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600"
                } ${isToday ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-neutral-950" : ""}`}
              >
                <span className="text-xs font-medium">{day}</span>
                <span className={`text-lg font-bold mt-1 ${isGym ? "text-teal-400" : "text-neutral-300"}`}>
                  {date.getDate()}
                </span>
                {isGym && (
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1" />
                )}
                {!isGym && <div className="w-1.5 h-1.5 mt-1" />}
              </button>
            )
          })}
        </div>

        {/* Selected day template picker */}
        {selectedDay !== null && isGymDay(selectedDay) && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-4">
            <p className="font-medium mb-3">
              {FULL_DAYS[selectedDay]} — assign a workout
            </p>
            <div className="space-y-2">
              <button
                onClick={() => assignTemplate(selectedDay, null)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                  getScheduleDay(selectedDay)?.template_id === null
                    ? "bg-teal-600/20 border-teal-500 text-white"
                    : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-600"
                }`}
              >
                Any workout (no specific template)
              </button>
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => assignTemplate(selectedDay, template.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    getScheduleDay(selectedDay)?.template_id === template.id
                      ? "bg-teal-600/20 border-teal-500 text-white"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-600"
                  }`}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
          <p className="text-sm font-medium mb-3">This week</p>
          <div className="space-y-2">
            {DAYS.map((day, i) => {
              const isGym = isGymDay(i)
              const schedDay = getScheduleDay(i)
              const isToday = i === currentDayOfWeek

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    isToday ? "bg-neutral-800" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium w-8 ${isToday ? "text-teal-400" : "text-neutral-400"}`}>
                      {day}
                    </span>
                    {isGym ? (
                      <span className="text-sm text-white">
                        {schedDay?.template_name || "Gym day"}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-600">Rest day</span>
                    )}
                  </div>
                  {isGym && (
                    <button
                      onClick={() => setSelectedDay(i)}
                      className="text-xs text-teal-400 hover:text-teal-300"
                    >
                      {schedDay?.template_id ? "Change" : "Assign"}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </main>
  )
}