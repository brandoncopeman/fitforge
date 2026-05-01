"use client"

import { useState, useRef, useEffect } from "react"
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

const BODY_PARTS = ["back", "cardio", "chest", "lower arm", "lower leg", "neck", "shoulder", "upper arm", "upper leg", "waist"]

function SortableTemplateExercise({
  exercise,
  children,
}: {
  exercise: TemplateExercise
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
      <div {...attributes} {...listeners} className="flex items-center justify-center w-full py-1 mb-2 cursor-grab active:cursor-grabbing touch-none">
        <div className="flex gap-1">
          {[...Array(6)].map((_, i) => <div key={i} className="w-1 h-1 rounded-full bg-neutral-600" />)}
        </div>
      </div>
      {children}
    </div>
  )
}

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
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customMuscle, setCustomMuscle] = useState("")
  const [favourites, setFavourites] = useState<Set<string>>(new Set())
  const [favouriteExercises, setFavouriteExercises] = useState<{ exercise_name: string; muscle_group: string }[]>([])

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDragging = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  useEffect(() => {
    fetch("/api/favourite-exercises").then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setFavouriteExercises(data)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFavourites(new Set(data.map((f: any) => f.exercise_name.toLowerCase())))
      }
    })
  }, [])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = exercises.findIndex(e => e.id === active.id)
    const newIndex = exercises.findIndex(e => e.id === over.id)
    const reordered = arrayMove(exercises, oldIndex, newIndex)
    setExercises(reordered)
    await Promise.all(
      reordered.map((ex, idx) =>
        fetch(`/api/template-exercises/${ex.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: idx }),
        })
      )
    )
  }

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
    setSearchQuery(part)
    setSelectedBodyPart(part)
    setSearching(true)
    setSearchResults([])
    try {
      const res = await fetch(`/api/exercises/search?q=${encodeURIComponent(part)}`)
      const data = await res.json()
      setSearchResults(Array.isArray(data) ? data : [])
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }

  async function toggleFavourite(exercise: { name: string; target?: string; bodyPart?: string; muscle_group?: string }) {
    const name = exercise.name.toLowerCase()
    const muscle = exercise.target || exercise.muscle_group || exercise.bodyPart || "other"
    if (favourites.has(name)) {
      setFavourites(prev => { const s = new Set(prev); s.delete(name); return s })
      setFavouriteExercises(prev => prev.filter(f => f.exercise_name.toLowerCase() !== name))
      fetch(`/api/favourite-exercises?name=${encodeURIComponent(exercise.name)}`, { method: "DELETE" })
    } else {
      setFavourites(prev => new Set([...prev, name]))
      setFavouriteExercises(prev => [...prev, { exercise_name: exercise.name, muscle_group: muscle }])
      fetch("/api/favourite-exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercise_name: exercise.name, muscle_group: muscle }),
      })
    }
  }

  async function addExercise(ex: { name: string; target?: string; bodyPart?: string; muscle_group?: string }) {
    const muscle = ex.target || ex.muscle_group || ex.bodyPart || "other"
    const res = await fetch("/api/template-exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: template.id, exercise_name: ex.name, muscle_group: muscle, order_index: exercises.length }),
    })
    const data = await res.json()
    setExercises(prev => [...prev, data])
    setShowSearch(false)
    setSearchQuery("")
    setSearchResults([])
    setSelectedBodyPart(null)
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
    setExercises(prev => prev.filter(e => e.id !== id))
    fetch(`/api/template-exercises/${id}`, { method: "DELETE" })
  }

  async function updateExercise(id: string, field: keyof TemplateExercise, value: number) {
    const safeValue = isNaN(value) ? 0 : value
    setExercises(prev => prev.map(e => e.id === id ? { ...e, [field]: safeValue } : e))
    fetch(`/api/template-exercises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: safeValue }),
    })
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

  const displayedExercises = searchQuery.length >= 2 ? searchResults : []

  return (
    <main className="min-h-screen bg-neutral-950 text-white pb-32">
      <div className="max-w-2xl mx-auto p-4">

        <div className="flex items-center justify-between py-4 mb-4">
          <Link href="/workouts" className="text-neutral-500 hover:text-neutral-300 text-sm">← Cancel</Link>
          <button onClick={save} disabled={saving} className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg text-sm">
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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 mb-6">
              {exercises.map(exercise => (
                <SortableTemplateExercise key={exercise.id} exercise={exercise}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold capitalize">{exercise.exercise_name}</p>
                      <p className="text-teal-400 text-xs capitalize">{exercise.muscle_group}</p>
                    </div>
                    <button onClick={() => removeExercise(exercise.id)} className="text-red-500 hover:text-red-400 text-xs font-medium border border-red-800 px-2 py-1 rounded-lg transition-colors">Remove</button>
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
                          <button onClick={() => updateExercise(exercise.id, field, Math.max(0, (isNaN(value) ? 0 : value) - step))} className="w-6 h-6 rounded bg-neutral-800 text-neutral-400 hover:text-white text-xs flex items-center justify-center">−</button>
                          <input type="number" value={isNaN(value) ? 0 : value} onChange={e => updateExercise(exercise.id, field, Number(e.target.value))} onFocus={e => e.target.select()} className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1 py-1 text-xs text-center focus:outline-none focus:border-teal-500 min-w-0" />
                          <button onClick={() => updateExercise(exercise.id, field, (isNaN(value) ? 0 : value) + step)} className="w-6 h-6 rounded bg-neutral-800 text-neutral-400 hover:text-white text-xs flex items-center justify-center">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </SortableTemplateExercise>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button onClick={() => setShowSearch(true)} className="w-full py-3 rounded-xl border border-neutral-800 border-dashed text-neutral-400 hover:text-teal-400 hover:border-teal-800 transition-colors">
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
                  <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); setSelectedBodyPart(null) }} className="text-neutral-500 hover:text-white text-sm">Cancel</button>
                </div>

                {!searchQuery && (
                  <div
                    className="flex gap-2 overflow-x-auto pb-1 cursor-grab active:cursor-grabbing select-none"
                    style={{ scrollbarWidth: "none" }}
                    onMouseDown={e => {
                      isDragging.current = false
                      const el = e.currentTarget
                      const startX = e.pageX - el.offsetLeft
                      const scrollLeft = el.scrollLeft
                      const onMove = (e: MouseEvent) => { isDragging.current = true; const x = e.pageX - el.offsetLeft; el.scrollLeft = scrollLeft - (x - startX) }
                      const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); setTimeout(() => { isDragging.current = false }, 50) }
                      window.addEventListener("mousemove", onMove)
                      window.addEventListener("mouseup", onUp)
                    }}
                  >
                    {BODY_PARTS.map(part => (
                      <button key={part} onClick={() => selectBodyPart(part)} className={`flex-shrink-0 px-3 py-1 rounded-full text-xs capitalize transition-colors ${selectedBodyPart === part ? "bg-teal-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}>
                        {part}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-y-auto flex-1 p-2">

                {/* Favourites */}
                {!searchQuery && !selectedBodyPart && favouriteExercises.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-neutral-500 px-3 py-1">★ Favourites</p>
                    {favouriteExercises.map((ex, i) => (
                      <div key={i} className="flex items-center hover:bg-neutral-800 rounded-lg transition-colors">
                        <button onClick={() => addExercise({ name: ex.exercise_name, muscle_group: ex.muscle_group })} className="flex-1 text-left p-3">
                          <p className="capitalize font-medium text-sm">{ex.exercise_name}</p>
                          <p className="text-xs text-yellow-400 capitalize mt-0.5">{ex.muscle_group} · favourite</p>
                        </button>
                        <button onClick={() => toggleFavourite({ name: ex.exercise_name, muscle_group: ex.muscle_group })} className="px-3 py-3 text-lg text-yellow-400 hover:text-neutral-600 transition-colors">★</button>
                      </div>
                    ))}
                    <div className="border-t border-neutral-800 my-2" />
                  </div>
                )}

                {searching && <p className="text-neutral-500 text-sm text-center py-6">Loading...</p>}
                {!searching && !searchQuery && !selectedBodyPart && favouriteExercises.length === 0 && (
                  <p className="text-neutral-500 text-sm text-center py-4">Search or pick a body part</p>
                )}
                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-neutral-500 text-sm text-center py-6">No exercises found</p>
                )}

                {displayedExercises.map(ex => (
                  <div key={ex.id} className="flex items-center hover:bg-neutral-800 rounded-lg transition-colors">
                    <button onClick={() => addExercise(ex)} className="flex-1 text-left p-3">
                      <p className="capitalize font-medium text-sm">{ex.name}</p>
                      <p className="text-xs text-teal-400 capitalize mt-0.5">{ex.target} · {ex.bodyPart}</p>
                    </button>
                    <button
                      onClick={() => toggleFavourite(ex)}
                      className={`px-3 py-3 text-lg transition-colors ${favourites.has(ex.name.toLowerCase()) ? "text-yellow-400" : "text-neutral-600 hover:text-yellow-400"}`}
                    >★</button>
                  </div>
                ))}

                <div className="border-t border-neutral-800 mt-2 pt-2">
                  {!showCustomForm ? (
                    <button onClick={() => setShowCustomForm(true)} className="w-full text-left p-3 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-teal-400 text-sm">
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