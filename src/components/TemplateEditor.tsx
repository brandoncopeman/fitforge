"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type TemplateExercise = {
  id: string
  exercise_name: string
  muscle_group: string
  order_index: number
  default_sets: number
  default_reps: number
  default_weight_kg: number
}

type ExerciseResult = {
  id: string
  name: string
  bodyPart: string
  target: string
}

const BODY_PARTS = ["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"]

export default function TemplateEditor({
  template,
  initialExercises,
}: {
  template: { id: string; name: string }
  initialExercises: TemplateExercise[]
}) {
  const router = useRouter()
  const [name, setName] = useState(template.name)
  const [exercises, setExercises] = useState<TemplateExercise[]>(initialExercises)
  const [saving, setSaving] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ExerciseResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null)
  const [bodyPartExercises, setBodyPartExercises] = useState<ExerciseResult[]>([])
  const [loadingBodyPart, setLoadingBodyPart] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customMuscle, setCustomMuscle] = useState("")

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDragging = useRef(false)

  function handleSearchInput(value: string) {
    setSearchQuery(value)
    setSelectedBodyPart(null)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (value.length < 2) { setSearchResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/exercises/search?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 400)
  }

  async function selectBodyPart(part: string) {
    if (isDragging.current) return
    setSelectedBodyPart(part)
    setSearchQuery("")
    setSearchResults([])
    setLoadingBodyPart(true)
    try {
      const res = await fetch(`/api/exercises/by-body-part?part=${encodeURIComponent(part)}`)
      const data = await res.json()
      setBodyPartExercises(Array.isArray(data) ? data : [])
    } catch { setBodyPartExercises([]) }
    finally { setLoadingBodyPart(false) }
  }

  async function addExercise(ex: { name: string; target?: string; bodyPart?: string; muscle_group?: string }) {
    const muscle = ex.target || ex.muscle_group || "other"
    const res = await fetch("/api/template-exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: template.id,
        exercise_name: ex.name,
        muscle_group: muscle,
        order_index: exercises.length,
      }),
    })
    const data = await res.json()
    setExercises(prev => [...prev, data])
    setShowSearch(false)
    setSearchQuery("")
    setSearchResults([])
    setSelectedBodyPart(null)
    setBodyPartExercises([])
  }

  async function addCustomExercise() {
    if (!customName.trim()) return
    const res = await fetch("/api/custom-exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: customName.trim(), muscle_group: customMuscle || "other" }),
    })
    const data = await res.json()
    await addExercise({ name: data.name, muscle_group: data.muscle_group })
    setCustomName("")
    setCustomMuscle("")
    setShowCustomForm(false)
  }

  async function removeExercise(id: string) {
    await fetch(`/api/template-exercises/${id}`, { method: "DELETE" })
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  async function updateExercise(id: string, field: keyof TemplateExercise, value: number) {
    const safeValue = isNaN(value) ? 0 : value
    setExercises(prev => prev.map(e => e.id === id ? { ...e, [field]: safeValue } : e))
    await fetch(`/api/template-exercises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: safeValue }),
    })
  }

  async function moveUp(idx: number) {
    if (idx === 0) return
    const above = exercises[idx - 1]
    const current = exercises[idx]
    await Promise.all([
      fetch(`/api/template-exercises/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_index: idx - 1 }) }),
      fetch(`/api/template-exercises/${above.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_index: idx }) }),
    ])
    const newExercises = [...exercises]
    newExercises[idx - 1] = { ...current, order_index: idx - 1 }
    newExercises[idx] = { ...above, order_index: idx }
    setExercises(newExercises)
  }

  async function moveDown(idx: number) {
    if (idx === exercises.length - 1) return
    const below = exercises[idx + 1]
    const current = exercises[idx]
    await Promise.all([
      fetch(`/api/template-exercises/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_index: idx + 1 }) }),
      fetch(`/api/template-exercises/${below.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_index: idx }) }),
    ])
    const newExercises = [...exercises]
    newExercises[idx + 1] = { ...current, order_index: idx + 1 }
    newExercises[idx] = { ...below, order_index: idx }
    setExercises(newExercises)
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    router.push("/workouts")
  }

  const displayedExercises = searchQuery.length >= 2 ? searchResults : selectedBodyPart ? bodyPartExercises : []

  return (
    <main className="min-h-screen bg-neutral-950 text-white pb-32">
      <div className="max-w-2xl mx-auto p-4">

        <div className="flex items-center justify-between py-4 mb-4">
          <Link href="/workouts" className="text-neutral-500 hover:text-neutral-300 text-sm">← Cancel</Link>
          <button
            onClick={save}
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg text-sm"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full text-2xl font-bold bg-transparent border-none outline-none text-white placeholder-neutral-600 mb-6"
          placeholder="Template name"
        />

        <div className="space-y-3 mb-6">
          {exercises.map((exercise, idx) => (
            <div key={exercise.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveUp(idx)} disabled={idx === 0} className="text-neutral-600 hover:text-white disabled:opacity-30 text-xs leading-none">▲</button>
                    <button onClick={() => moveDown(idx)} disabled={idx === exercises.length - 1} className="text-neutral-600 hover:text-white disabled:opacity-30 text-xs leading-none">▼</button>
                  </div>
                  <div>
                    <p className="font-semibold capitalize">{exercise.exercise_name}</p>
                    <p className="text-teal-400 text-xs capitalize">{exercise.muscle_group}</p>
                  </div>
                </div>
                <button onClick={() => removeExercise(exercise.id)} className="text-neutral-600 hover:text-red-400 text-sm">Remove</button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Sets", field: "default_sets" as const, value: exercise.default_sets, step: 1 },
                  { label: "Reps", field: "default_reps" as const, value: exercise.default_reps, step: 1 },
                  { label: "Weight (kg)", field: "default_weight_kg" as const, value: exercise.default_weight_kg, step: 2.5 },
                ].map(({ label, field, value, step }) => (
                  <div key={field}>
                    <p className="text-xs text-neutral-500 mb-1">{label}</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateExercise(exercise.id, field, Math.max(0, (isNaN(value) ? 0 : value) - step))}
                        className="w-6 h-6 rounded bg-neutral-800 text-neutral-400 hover:text-white text-xs flex items-center justify-center"
                      >−</button>
                      <input
                        type="number"
                        value={isNaN(value) ? 0 : value}
                        onChange={e => updateExercise(exercise.id, field, Number(e.target.value))}
                        onFocus={e => e.target.select()}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1 py-1 text-xs text-center focus:outline-none focus:border-teal-500 min-w-0"
                      />
                      <button
                        onClick={() => updateExercise(exercise.id, field, (isNaN(value) ? 0 : value) + step)}
                        className="w-6 h-6 rounded bg-neutral-800 text-neutral-400 hover:text-white text-xs flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowSearch(true)}
          className="w-full py-3 rounded-xl border border-neutral-800 border-dashed text-neutral-400 hover:text-teal-400 hover:border-teal-800 transition-colors"
        >
          + Add Exercise
        </button>

        {showSearch && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-md flex flex-col" style={{ maxHeight: "85vh" }}>
              <div className="p-4 border-b border-neutral-800">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchInput(e.target.value)}
                    placeholder="Search exercises or body part..."
                    className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                    autoFocus
                  />
                  <button
                    onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); setSelectedBodyPart(null) }}
                    className="text-neutral-500 hover:text-white text-sm"
                  >
                    Cancel
                  </button>
                </div>

                {/* Draggable body part pills */}
                {!searchQuery && (
                  <div
                    className="flex gap-2 overflow-x-auto pb-1 cursor-grab active:cursor-grabbing select-none"
                    style={{ scrollbarWidth: "none" }}
                    onMouseDown={(e) => {
                      isDragging.current = false
                      const el = e.currentTarget
                      const startX = e.pageX - el.offsetLeft
                      const scrollLeft = el.scrollLeft
                      const onMove = (e: MouseEvent) => {
                        isDragging.current = true
                        const x = e.pageX - el.offsetLeft
                        el.scrollLeft = scrollLeft - (x - startX)
                      }
                      const onUp = () => {
                        window.removeEventListener("mousemove", onMove)
                        window.removeEventListener("mouseup", onUp)
                        setTimeout(() => { isDragging.current = false }, 50)
                      }
                      window.addEventListener("mousemove", onMove)
                      window.addEventListener("mouseup", onUp)
                    }}
                  >
                    {BODY_PARTS.map(part => (
                      <button
                        key={part}
                        onClick={() => selectBodyPart(part)}
                        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                          selectedBodyPart === part
                            ? "bg-teal-600 text-white"
                            : "bg-neutral-800 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {part}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-y-auto flex-1 p-2">
                {(searching || loadingBodyPart) && (
                  <p className="text-neutral-500 text-sm text-center py-6">Loading...</p>
                )}
                {!searching && !loadingBodyPart && !searchQuery && !selectedBodyPart && (
                  <p className="text-neutral-500 text-sm text-center py-4">Search or pick a body part</p>
                )}
                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-neutral-500 text-sm text-center py-6">No exercises found</p>
                )}
                {displayedExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise(ex)}
                    className="w-full text-left p-3 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    <p className="capitalize font-medium text-sm">{ex.name}</p>
                    <p className="text-xs text-teal-400 capitalize mt-0.5">{ex.target} · {ex.bodyPart}</p>
                  </button>
                ))}

                <div className="border-t border-neutral-800 mt-2 pt-2">
                  {!showCustomForm ? (
                    <button
                      onClick={() => setShowCustomForm(true)}
                      className="w-full text-left p-3 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-teal-400 text-sm"
                    >
                      + Create custom exercise
                    </button>
                  ) : (
                    <div className="p-3 space-y-2">
                      <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Exercise name" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                      <input type="text" value={customMuscle} onChange={e => setCustomMuscle(e.target.value)} placeholder="Muscle group" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                      <div className="flex gap-2">
                        <button onClick={addCustomExercise} disabled={!customName.trim()} className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm">Add</button>
                        <button onClick={() => setShowCustomForm(false)} className="flex-1 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-sm">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}