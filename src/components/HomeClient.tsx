"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/* ================= TYPES ================= */

type Profile = {
  display_name?: string
  daily_calorie_target: number
  daily_protein_target: number
  daily_step_target?: number
  show_weight_on_home?: boolean
  daily_quote?: {
    text?: string
    author?: string
  }
}

type ScheduleItem = {
  day_of_week: number
  template_name?: string | null
}

type WorkoutTemplate = {
  id: string | number
  name: string
  exercise_count?: number | null
}

/* ================= SORTABLE ================= */

function SortableSection({
  id,
  children,
  onClickCapture,
}: {
  id: string
  children: React.ReactNode
  onClickCapture: (e: React.MouseEvent) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClickCapture={onClickCapture}
      className="cursor-grab active:cursor-grabbing touch-none h-full"
    >
      {children}
    </div>
  )
}

/* ================= MAIN ================= */

export default function HomeClient({
  profile,
  caloriesConsumed,
  todaySteps,
  latestWeight,
  schedule,
  todayDow,
  nextTemplate,
  sectionOrder: initialOrder,
}: {
  profile: Profile
  caloriesConsumed: number
  todaySteps: number
  latestWeight: number | null
  schedule: ScheduleItem[]
  todayDow: number
  nextTemplate: WorkoutTemplate | null
  sectionOrder: string[]
}) {
  const [sectionOrder, setSectionOrder] = useState(initialOrder)

  // ✅ drag fix
  const isDraggingRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  )

  function handleDragStart() {
    isDraggingRef.current = true
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(String(active.id))
      const newIndex = sectionOrder.indexOf(String(over.id))
      const reordered = arrayMove(sectionOrder, oldIndex, newIndex)

      setSectionOrder(reordered)

      fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_section_order: reordered }),
      })
    }

    // prevent click after drag
    setTimeout(() => {
      isDraggingRef.current = false
    }, 50)
  }

  const getSchedDay = (i: number) =>
    schedule.find((s) => s.day_of_week === i)

  const SECTIONS: Record<string, React.ReactNode> = {
    calories: (
      <Link href="/food" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        <p className="text-neutral-400 text-xs mb-1">Daily Calories</p>
        <p className="text-2xl font-bold text-teal-400">{caloriesConsumed}</p>
        <p className="text-neutral-500 text-xs mt-1">of {profile.daily_calorie_target} kcal</p>
        <div className="w-full h-1 bg-neutral-800 rounded-full mt-3">
          <div
            className={`h-1 rounded-full ${
              caloriesConsumed > profile.daily_calorie_target ? "bg-red-500" : "bg-teal-500"
            }`}
            style={{
              width: `${Math.min(
                100,
                (caloriesConsumed / profile.daily_calorie_target) * 100
              )}%`,
            }}
          />
        </div>
      </Link>
    ),

    protein: (
      <Link href="/macros" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        {profile.show_weight_on_home && latestWeight ? (
          <>
            <p className="text-neutral-400 text-xs mb-1">Weight</p>
            <p className="text-2xl font-bold text-white">
              {latestWeight}
              <span className="text-base text-neutral-400">kg</span>
            </p>
            <p className="text-neutral-500 text-xs mt-1">tap to update</p>
          </>
        ) : (
          <>
            <p className="text-neutral-400 text-xs mb-1">Daily Protein</p>
            <p className="text-2xl font-bold text-teal-400">
              {profile.daily_protein_target}g
            </p>
            <p className="text-neutral-500 text-xs mt-1">protein target</p>
          </>
        )}
        <div className="w-full h-1 bg-neutral-800 rounded-full mt-3">
          <div className="h-1 rounded-full bg-blue-500" style={{ width: "0%" }} />
        </div>
      </Link>
    ),

    steps: (
      <Link href="/steps" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        <p className="text-neutral-400 text-xs mb-1">Daily Steps</p>
        <p className="text-2xl font-bold text-white">
          {todaySteps.toLocaleString()}
        </p>
        <p className="text-neutral-500 text-xs mt-1">
          of {profile.daily_step_target?.toLocaleString()} goal
        </p>
        <div className="w-full h-1 bg-neutral-800 rounded-full mt-3">
          <div
            className="h-1 bg-teal-600 rounded-full"
            style={{
              width: `${Math.min(
                100,
                (todaySteps / (profile.daily_step_target || 8000)) * 100
              )}%`,
            }}
          />
        </div>
      </Link>
    ),

    schedule: (
      <Link href="/schedule" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        <p className="text-neutral-400 text-xs mb-2">This Week</p>
        <div className="grid grid-cols-7 gap-0.5">
          {DAYS_SHORT.map((day, i) => {
            const sd = getSchedDay(i)
            const isGym = !!sd
            const isToday = i === todayDow

            return (
              <div key={i} className="flex flex-col items-center">
                <span
                  className={`text-xs mb-0.5 ${
                    isToday ? "font-bold text-teal-400" : "text-neutral-500"
                  }`}
                >
                  {day[0]}
                </span>
                <div
                  className={`w-full aspect-square rounded flex items-center justify-center ${
                    isGym ? "bg-teal-600" : "bg-neutral-800"
                  } ${isToday ? "ring-1 ring-teal-400" : ""}`}
                >
                  {isGym && sd?.template_name && (
                    <div className="w-1 h-1 rounded-full bg-white" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Link>
    ),

    workouts: (
      <Link href="/workouts" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        <p className="text-neutral-400 text-xs mb-1">Workouts</p>
        <p className="text-xl">🏋️</p>
        <p className="text-neutral-400 text-xs mt-2">
          Templates & history
        </p>
      </Link>
    ),

    stats: (
      <Link href="/stats" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        <p className="text-neutral-400 text-xs mb-1">Stats</p>
        <p className="text-xl">📈</p>
        <p className="text-neutral-400 text-xs mt-2">
          Progress & records
        </p>
      </Link>
    ),

    goals: (
      <Link href="/goals" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        <p className="text-neutral-400 text-xs mb-1">Goals</p>
        <p className="text-xl">🎯</p>
        <p className="text-neutral-400 text-xs mt-2">
          Daily habits & tracker
        </p>
      </Link>
    ),

    food: (
      <Link href="/food" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        <p className="text-neutral-400 text-xs mb-1">Food</p>
        <p className="text-xl">🥗</p>
        <p className="text-neutral-400 text-xs mt-2">
          Log meals & macros
        </p>
      </Link>
    ),

    macros: (
      <Link href="/macros" className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full">
        <p className="text-neutral-400 text-xs mb-1">Macros</p>
        <p className="text-xl">⚖️</p>
        <p className="text-neutral-400 text-xs mt-2">
          TDEE & targets
        </p>
      </Link>
    ),

    next: (
      <Link
        href={
          nextTemplate
            ? `/workouts/new?template=${nextTemplate.id}`
            : "/workouts/new"
        }
        className="bg-teal-600/10 border border-teal-700/50 hover:bg-teal-600/20 rounded-xl p-4 transition-colors block h-full"
      >
        <p className="text-xs text-teal-400 font-medium mb-0.5">
          {nextTemplate ? "Next in plan" : "No plan set up"}
        </p>
        <p className="text-white font-semibold text-sm">
          {nextTemplate ? nextTemplate.name : "Empty Workout"}
        </p>
        <p className="text-neutral-400 text-xs mt-1">
          {nextTemplate
            ? `${nextTemplate.exercise_count ?? ""} exercises`
            : "Free session"}
        </p>
      </Link>
    ),
  }

  const gridSections = sectionOrder.filter((s) => SECTIONS[s])

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-5">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">FitForge</h1>
          <UserButton />
        </div>

        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5 mb-4">
          <h2 className="text-lg font-semibold mb-2">
            Welcome back, {profile.display_name || "there"}!
          </h2>
          <p className="text-neutral-300 text-sm italic">
            “{profile.daily_quote?.text}”
          </p>
          <p className="text-neutral-500 text-xs mt-1">
            — {profile.daily_quote?.author}
          </p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={gridSections} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 auto-rows-fr">
              {gridSections.map((id) => (
                <SortableSection
                  key={id}
                  id={id}
                  onClickCapture={(e) => {
                    if (isDraggingRef.current) {
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                >
                  {SECTIONS[id]}
                </SortableSection>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </main>
  )
}