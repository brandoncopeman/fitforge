"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

type Template = {
  id: string
  name: string
  in_plan: boolean
  plan_order: number | null
  exercise_count: number
}

function SortablePlanTemplate({
  template,
  idx,
  children,
}: {
  template: Template
  idx: number
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none flex flex-col gap-0.5 px-1 py-2"
        >
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-neutral-600" />
              <div className="w-1 h-1 rounded-full bg-neutral-600" />
            </div>
          ))}
        </div>
        <div className="w-7 h-7 rounded-full bg-teal-600/20 border border-teal-700/50 flex items-center justify-center flex-shrink-0">
          <span className="text-teal-400 text-xs font-bold">{idx + 1}</span>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function TemplateManager({
  initialTemplates,
  lastPlanIndex,
}: {
  initialTemplates: Template[]
  lastPlanIndex: number
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState("")

  const planTemplates = templates
    .filter(t => t.in_plan)
    .sort((a, b) => (a.plan_order ?? 999) - (b.plan_order ?? 999))

  const otherTemplates = templates.filter(t => !t.in_plan)

  const nextPlanIndex = planTemplates.length > 0
    ? (lastPlanIndex + 1) % planTemplates.length
    : -1
  const nextTemplate = nextPlanIndex >= 0 ? planTemplates[nextPlanIndex] : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = planTemplates.findIndex(t => t.id === active.id)
    const newIndex = planTemplates.findIndex(t => t.id === over.id)
    const reordered = arrayMove(planTemplates, oldIndex, newIndex)

    // Optimistic update
    setTemplates(prev => {
      const nonPlan = prev.filter(t => !t.in_plan)
      const reorderedWithIndex = reordered.map((t, i) => ({ ...t, plan_order: i }))
      return [...nonPlan, ...reorderedWithIndex]
    })

    // Save to DB
    await Promise.all(
      reordered.map((t, i) =>
        fetch(`/api/templates/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_order: i }),
        })
      )
    )
  }

  async function createTemplate() {
    if (!newName.trim()) return
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    setTemplates(prev => [...prev, { ...data, exercise_count: 0 }])
    setNewName("")
    setCreatingNew(false)
    router.push(`/workouts/templates/${data.id}`)
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return
    setTemplates(prev => prev.filter(t => t.id !== id))
    fetch(`/api/templates/${id}`, { method: "DELETE" })
  }

  async function toggleInPlan(template: Template) {
    const newInPlan = !template.in_plan
    const newOrder = newInPlan ? planTemplates.length : null

    setTemplates(prev => prev.map(t =>
      t.id === template.id ? { ...t, in_plan: newInPlan, plan_order: newOrder } : t
    ))

    fetch(`/api/templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ in_plan: newInPlan, plan_order: newOrder }),
    })
  }

  return (
    <div className="space-y-6">

      {/* Start Workout */}
      <div className="bg-teal-600/10 border border-teal-700/50 rounded-xl p-4">
        {nextTemplate ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-teal-400 mb-0.5 font-medium">Next in your plan</p>
              <p className="text-white font-semibold">{nextTemplate.name}</p>
              <p className="text-neutral-400 text-xs mt-0.5">{nextTemplate.exercise_count} exercises</p>
            </div>
            <Link
              href={`/workouts/new?template=${nextTemplate.id}`}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0"
            >
              Start Workout
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-teal-400 mb-0.5 font-medium">No plan set up yet</p>
              <p className="text-white font-semibold">Empty Workout</p>
              <p className="text-neutral-400 text-xs mt-0.5">Add templates to your plan below</p>
            </div>
            <Link
              href="/workouts/new"
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0"
            >
              Start Workout
            </Link>
          </div>
        )}
      </div>

      {/* My Workout Plan */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">My Workout Plan</h2>
          <span className="text-neutral-500 text-xs">{planTemplates.length} templates</span>
        </div>

        {planTemplates.length === 0 ? (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 text-center">
            <p className="text-neutral-500 text-sm">No templates in your plan yet.</p>
            <p className="text-neutral-600 text-xs mt-1">Add a template below to get started.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={planTemplates.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {planTemplates.map((template, idx) => (
                  <SortablePlanTemplate key={template.id} template={template} idx={idx}>
                    <Link href={`/workouts/templates/${template.id}/detail`} className="flex-1 min-w-0">
                      <p className="font-medium truncate">{template.name}</p>
                      <p className="text-neutral-500 text-xs mt-0.5">{template.exercise_count} exercises</p>
                    </Link>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/workouts/templates/${template.id}`}
                        className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-xs"
                      >✎</Link>
                      <button
                        onClick={() => toggleInPlan(template)}
                        className="w-7 h-7 rounded bg-neutral-800 text-red-400 hover:text-red-300 flex items-center justify-center text-xs"
                        title="Remove from plan"
                      >−</button>
                    </div>
                  </SortablePlanTemplate>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Other Templates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Other Templates</h2>
          <button
            onClick={() => setCreatingNew(true)}
            className="text-teal-400 hover:text-teal-300 text-sm"
          >
            + New
          </button>
        </div>

        {creatingNew && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Template name (e.g. Push Day)"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-teal-500"
              autoFocus
              onKeyDown={e => e.key === "Enter" && createTemplate()}
            />
            <div className="flex gap-2">
              <button
                onClick={createTemplate}
                disabled={!newName.trim()}
                className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm"
              >
                Create & Edit
              </button>
              <button
                onClick={() => { setCreatingNew(false); setNewName("") }}
                className="flex-1 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {otherTemplates.length === 0 && !creatingNew ? (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 text-center">
            <p className="text-neutral-500 text-sm">No other templates yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {otherTemplates.map(template => (
              <div key={template.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex items-center gap-3">
                <Link href={`/workouts/templates/${template.id}/detail`} className="flex-1 min-w-0">
                  <p className="font-medium truncate">{template.name}</p>
                  <p className="text-neutral-500 text-xs mt-0.5">{template.exercise_count} exercises</p>
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleInPlan(template)}
                    className="px-2 h-7 rounded bg-neutral-800 text-teal-400 hover:text-teal-300 flex items-center justify-center text-xs"
                    title="Add to plan"
                  >+ Plan</button>
                  <Link
                    href={`/workouts/templates/${template.id}`}
                    className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-xs"
                  >✎</Link>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="w-7 h-7 rounded bg-neutral-800 text-neutral-600 hover:text-red-400 flex items-center justify-center text-xs"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}