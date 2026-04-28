"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type Template = {
  id: string
  name: string
  in_plan: boolean
  plan_order: number | null
  exercise_count: number
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
    await fetch(`/api/templates/${id}`, { method: "DELETE" })
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function toggleInPlan(template: Template) {
    const newInPlan = !template.in_plan
    const newOrder = newInPlan ? planTemplates.length : null

    await fetch(`/api/templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ in_plan: newInPlan, plan_order: newOrder }),
    })

    setTemplates(prev => prev.map(t =>
      t.id === template.id ? { ...t, in_plan: newInPlan, plan_order: newOrder } : t
    ))
  }

  async function moveUp(template: Template) {
    const idx = planTemplates.findIndex(t => t.id === template.id)
    if (idx === 0) return
    const above = planTemplates[idx - 1]

    await Promise.all([
      fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_order: idx - 1 }),
      }),
      fetch(`/api/templates/${above.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_order: idx }),
      }),
    ])

    setTemplates(prev => prev.map(t => {
      if (t.id === template.id) return { ...t, plan_order: idx - 1 }
      if (t.id === above.id) return { ...t, plan_order: idx }
      return t
    }))
  }

  async function moveDown(template: Template) {
    const idx = planTemplates.findIndex(t => t.id === template.id)
    if (idx === planTemplates.length - 1) return
    const below = planTemplates[idx + 1]

    await Promise.all([
      fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_order: idx + 1 }),
      }),
      fetch(`/api/templates/${below.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_order: idx }),
      }),
    ])

    setTemplates(prev => prev.map(t => {
      if (t.id === template.id) return { ...t, plan_order: idx + 1 }
      if (t.id === below.id) return { ...t, plan_order: idx }
      return t
    }))
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
          <div className="space-y-2">
            {planTemplates.map((template, idx) => (
  <div key={template.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-teal-600/20 border border-teal-700/50 flex items-center justify-center flex-shrink-0">
        <span className="text-teal-400 text-xs font-bold">{idx + 1}</span>
      </div>
      <Link href={`/workouts/templates/${template.id}/detail`} className="flex-1 min-w-0">
        <p className="font-medium truncate">{template.name}</p>
        <p className="text-neutral-500 text-xs mt-0.5">{template.exercise_count} exercises</p>
      </Link>
      <div className="flex items-center gap-1">
        <button onClick={() => moveUp(template)} disabled={idx === 0}
          className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 flex items-center justify-center text-xs">↑</button>
        <button onClick={() => moveDown(template)} disabled={idx === planTemplates.length - 1}
          className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 flex items-center justify-center text-xs">↓</button>
        <Link href={`/workouts/templates/${template.id}`}
          className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-xs">✎</Link>
        <button onClick={() => toggleInPlan(template)}
          className="w-7 h-7 rounded bg-neutral-800 text-red-400 hover:text-red-300 flex items-center justify-center text-xs"
          title="Remove from plan">−</button>
      </div>
    </div>
  </div>
))}
          </div>
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
      <button onClick={() => toggleInPlan(template)}
        className="px-2 h-7 rounded bg-neutral-800 text-teal-400 hover:text-teal-300 flex items-center justify-center text-xs"
        title="Add to plan">+ Plan</button>
      <Link href={`/workouts/templates/${template.id}`}
        className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-xs">✎</Link>
      <button onClick={() => deleteTemplate(template.id)}
        className="w-7 h-7 rounded bg-neutral-800 text-neutral-600 hover:text-red-400 flex items-center justify-center text-xs">✕</button>
    </div>
  </div>
))}
          </div>
        )}
      </div>

    </div>
  )
}