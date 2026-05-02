"use client"

import { useState } from "react"
import Link from "next/link"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type Goal = {
  id: string
  name: string
  emoji: string
  color: string
  order_index: number
}

type Completion = {
  goal_id: string
  completed_date: string
}

const COLORS = [
  { id: "teal", class: "bg-teal-500", ring: "ring-teal-400" },
  { id: "blue", class: "bg-blue-500", ring: "ring-blue-400" },
  { id: "purple", class: "bg-purple-500", ring: "ring-purple-400" },
  { id: "pink", class: "bg-pink-500", ring: "ring-pink-400" },
  { id: "orange", class: "bg-orange-500", ring: "ring-orange-400" },
  { id: "yellow", class: "bg-yellow-500", ring: "ring-yellow-400" },
  { id: "green", class: "bg-green-500", ring: "ring-green-400" },
  { id: "red", class: "bg-red-500", ring: "ring-red-400" },
]

const EMOJIS = ["🎯", "💪", "🏃", "🥗", "📚", "🧘", "💧", "😴", "✍️", "🚴", "🏋️", "🧠", "❤️", "⚡"]

const DAYS = ["S", "M", "T", "W", "T", "F", "S"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function getColorClass(color: string) {
  return COLORS.find(c => c.id === color)?.class || "bg-teal-500"
}

function SortableGoalRow({
  goal,
  children,
}: {
  goal: Goal
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: goal.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-neutral-900 rounded-xl border border-neutral-800 p-3">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none px-1">
        <div className="flex flex-col gap-0.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-neutral-600" />
              <div className="w-1 h-1 rounded-full bg-neutral-600" />
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function GoalsClient({
  initialGoals,
  initialCompletions,
  today,
}: {
  initialGoals: Goal[]
  initialCompletions: Completion[]
  today: string
}) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [completions, setCompletions] = useState<Completion[]>(initialCompletions)
  const [selectedDate, setSelectedDate] = useState(today)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [newGoalName, setNewGoalName] = useState("")
  const [newGoalEmoji, setNewGoalEmoji] = useState("🎯")
  const [newGoalColor, setNewGoalColor] = useState("teal")
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  function isCompleted(goalId: string, date: string) {
    return completions.some(c => c.goal_id === goalId && c.completed_date?.toString().startsWith(date))
  }

  async function toggleCompletion(goalId: string, date: string) {
    const done = isCompleted(goalId, date)
    if (done) {
      setCompletions(prev => prev.filter(c => !(c.goal_id === goalId && c.completed_date?.toString().startsWith(date))))
      fetch(`/api/goals/completions?goal_id=${goalId}&date=${date}`, { method: "DELETE" })
    } else {
      setCompletions(prev => [...prev, { goal_id: goalId, completed_date: date }])
      fetch("/api/goals/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goalId, completed_date: date }),
      })
    }
  }

  async function addGoal() {
    if (!newGoalName.trim()) return
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGoalName.trim(), emoji: newGoalEmoji, color: newGoalColor }),
    })
    const data = await res.json()
    setGoals(prev => [...prev, data])
    setNewGoalName("")
    setNewGoalEmoji("🎯")
    setNewGoalColor("teal")
    setShowAddGoal(false)
  }

  async function deleteGoal(id: string) {
    if (!confirm("Remove this goal?")) return
    setGoals(prev => prev.filter(g => g.id !== id))
    fetch(`/api/goals/${id}`, { method: "DELETE" })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = goals.findIndex(g => g.id === active.id)
    const newIndex = goals.findIndex(g => g.id === over.id)
    const reordered = arrayMove(goals, oldIndex, newIndex)
    setGoals(reordered)
    await Promise.all(
      reordered.map((g, i) =>
        fetch(`/api/goals/${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: i }),
        })
      )
    )
  }

  // Calendar days
  const year = calendarMonth.getFullYear()
  const month = calendarMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Last 7 days for quick view
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - 6 + i)
    return d.toISOString().split("T")[0]
  })

  // Weekly stats
  const weekStart = last7[0]
  const weekStats = goals.map(goal => ({
    ...goal,
    daysThisWeek: last7.filter(d => isCompleted(goal.id, d)).length,
  }))

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 pb-24">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300">← Home</Link>
          <h1 className="text-2xl font-bold mt-1">Goals</h1>
        </div>

        {/* Calendar heatmap */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="text-neutral-400 hover:text-white px-2 py-1 rounded text-sm">‹</button>
            <p className="text-sm font-medium">{MONTHS[month]} {year}</p>
            <button
              onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              disabled={calendarMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
              className="text-neutral-400 hover:text-white px-2 py-1 rounded text-sm disabled:opacity-30"
            >›</button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS.map((d, i) => <p key={i} className="text-xs text-neutral-600 text-center">{d}</p>)}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}
            {[...Array(daysInMonth)].map((_, i) => {
              const d = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
              const completedCount = goals.filter(g => isCompleted(g.id, dateStr)).length
              const totalGoals = goals.length
              const ratio = totalGoals > 0 ? completedCount / totalGoals : 0
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              const isFuture = dateStr > today

              let bg = "bg-neutral-800"
              if (!isFuture && totalGoals > 0) {
                if (ratio === 1) bg = "bg-teal-500"
                else if (ratio >= 0.5) bg = "bg-teal-700"
                else if (ratio > 0) bg = "bg-teal-900"
              }

              return (
                <button
                  key={dateStr}
                  onClick={() => !isFuture && setSelectedDate(dateStr)}
                  disabled={isFuture}
                  className={`aspect-square rounded flex items-center justify-center text-xs transition-all ${bg} ${isToday ? "ring-1 ring-white" : ""} ${isSelected ? "ring-2 ring-teal-400" : ""} ${isFuture ? "opacity-20" : "hover:ring-1 hover:ring-neutral-500"}`}
                >
                  <span className={isToday ? "text-white font-bold" : "text-neutral-400"}>{d}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 mt-3 justify-center">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-teal-500" /><span className="text-xs text-neutral-500">All done</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-teal-700" /><span className="text-xs text-neutral-500">Partial</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-neutral-800" /><span className="text-xs text-neutral-500">None</span></div>
          </div>
        </div>

        {/* Selected date goal list */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium">
                {selectedDate === today ? "Today" : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {goals.filter(g => isCompleted(g.id, selectedDate)).length}/{goals.length} completed
              </p>
            </div>
            {selectedDate === today && goals.length > 0 && (
              <button
                onClick={() => {
                  const allDone = goals.every(g => isCompleted(g.id, today))
                  goals.forEach(g => {
                    if (allDone || !isCompleted(g.id, today)) toggleCompletion(g.id, today)
                  })
                }}
                className="text-xs text-teal-400 hover:text-teal-300 border border-teal-700/50 px-3 py-1.5 rounded-lg"
              >
                {goals.every(g => isCompleted(g.id, today)) ? "Unmark All" : "Mark All Done"}
              </button>
            )}
          </div>

          {goals.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-4">No goals yet — add one below</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={goals.map(g => g.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {goals.map(goal => {
                    const done = isCompleted(goal.id, selectedDate)
                    const colorClass = getColorClass(goal.color)
                    return (
                      <SortableGoalRow key={goal.id} goal={goal}>
                        <button
                          onClick={() => toggleCompletion(goal.id, selectedDate)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-all ${done ? colorClass + " shadow-lg scale-105" : "bg-neutral-800"}`}
                        >
                          {goal.emoji}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium transition-colors ${done ? "text-white" : "text-neutral-400"}`}>
                            {goal.name}
                          </p>
                          <p className="text-xs text-neutral-600 mt-0.5">
                            {weekStats.find(s => s.id === goal.id)?.daysThisWeek || 0}/7 this week
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => toggleCompletion(goal.id, selectedDate)}
                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${done ? `${colorClass} border-transparent text-white` : "border-neutral-700 text-transparent"}`}
                          >
                            ✓
                          </button>
                          <button onClick={() => deleteGoal(goal.id)} className="text-neutral-700 hover:text-red-400 text-xs transition-colors">✕</button>
                        </div>
                      </SortableGoalRow>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add goal */}
          {showAddGoal ? (
            <div className="mt-3 pt-3 border-t border-neutral-800 space-y-3">
              <input
                type="text"
                value={newGoalName}
                onChange={e => setNewGoalName(e.target.value)}
                placeholder="Goal name (e.g. Gym, Read, Meditate)"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                autoFocus
                onKeyDown={e => e.key === "Enter" && addGoal()}
              />

              <div>
                <p className="text-xs text-neutral-500 mb-2">Emoji</p>
                <div className="flex gap-2 flex-wrap">
                  {EMOJIS.map(em => (
                    <button
                      key={em}
                      onClick={() => setNewGoalEmoji(em)}
                      className={`text-xl p-1.5 rounded-lg transition-colors ${newGoalEmoji === em ? "bg-neutral-700 ring-2 ring-teal-500" : "hover:bg-neutral-800"}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-2">Color</p>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setNewGoalColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.class} transition-transform ${newGoalColor === c.id ? "ring-2 ring-white scale-110" : ""}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={addGoal} disabled={!newGoalName.trim()} className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm">Add Goal</button>
                <button onClick={() => setShowAddGoal(false)} className="flex-1 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddGoal(true)}
              className="mt-3 w-full py-2.5 border border-dashed border-neutral-700 text-neutral-400 hover:text-teal-400 hover:border-teal-700 rounded-xl text-sm transition-colors"
            >
              + Add Goal
            </button>
          )}
        </div>

        {/* Weekly stats */}
        {goals.length > 0 && (
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 mb-4">
            <p className="text-sm font-medium mb-3">This Week</p>
            <div className="space-y-3">
              {weekStats.map(goal => (
                <div key={goal.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{goal.emoji}</span>
                      <span className="text-sm text-neutral-300">{goal.name}</span>
                    </div>
                    <span className="text-xs text-neutral-500">{goal.daysThisWeek}/7</span>
                  </div>
                  <div className="flex gap-1">
                    {last7.map(date => {
                      const done = isCompleted(goal.id, date)
                      const colorClass = getColorClass(goal.color)
                      const isToday = date === today
                      return (
                        <button
                          key={date}
                          onClick={() => toggleCompletion(goal.id, date)}
                          className={`flex-1 h-6 rounded transition-all ${done ? colorClass : "bg-neutral-800"} ${isToday ? "ring-1 ring-white" : ""}`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    {last7.map(date => {
                      const d = new Date(date)
                      return <p key={date} className="flex-1 text-center text-neutral-600" style={{ fontSize: "9px" }}>{DAYS[d.getDay()]}</p>
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}