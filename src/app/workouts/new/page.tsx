"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type Exercise = {
  id: string
  name: string
  bodyPart: string
  target: string
}

type SetEntry = {
  id: string
  set_number: number
  reps: number | ""
  weight_kg: number | ""
  saved_reps?: number
  saved_weight?: number
  completed?: boolean
}

type WorkoutExercise = {
  id: string
  exercise_name: string
  muscle_group: string
  sets: SetEntry[]
  last_session?: { weight_kg: number; reps: number; set_number: number }[]
}

const BODY_PARTS = ["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"]

export default function NewWorkoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get("template")

  const [workoutId, setWorkoutId] = useState<string | null>(null)
  const [workoutName, setWorkoutName] = useState("My Workout")
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [startTime] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState("")

  // Search panel state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Exercise[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null)
  const [bodyPartExercises, setBodyPartExercises] = useState<Exercise[]>([])
  const [loadingBodyPart] = useState(false)

  // Custom exercise state
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customMuscle, setCustomMuscle] = useState("")
  const [customExercises, setCustomExercises] = useState<{ id: string; name: string; muscle_group: string }[]>([])

  // Rest timer state
  const [restDuration, setRestDuration] = useState(120)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [showRestPicker, setShowRestPicker] = useState(false)
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const initialized = useRef(false)
  const isDragging = useRef(false)

  // Create workout on mount, optionally loading a template
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Workout" }),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error("Failed to create workout:", res.status, text)
        setError("Failed to start workout. Please try again.")
        return
      }

      const data = await res.json()
      setWorkoutId(data.id)

      if (templateId) {
        const tRes = await fetch(`/api/templates/${templateId}`)
        const tData = await tRes.json()
        if (tData.template) {
          setWorkoutName(tData.template.name)
          for (const te of tData.exercises) {
            const weRes = await fetch("/api/workout-exercises", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                workout_id: data.id,
                exercise_name: te.exercise_name,
                muscle_group: te.muscle_group,
                order_index: te.order_index,
              }),
            })
            const weData = await weRes.json()

            const lastRes = await fetch(`/api/exercises/last-sets?name=${encodeURIComponent(te.exercise_name)}`)
            const lastSets = await lastRes.json()

            const sets: SetEntry[] = []
            for (let i = 0; i < (te.default_sets || 3); i++) {
              const lastSet = Array.isArray(lastSets) ? lastSets[i] : null
              const prefillReps = lastSet?.reps ?? te.default_reps ?? 8
              const prefillWeight = lastSet?.weight_kg ?? te.default_weight_kg ?? 0

              const setRes = await fetch("/api/exercise-sets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workout_exercise_id: weData.id,
                  set_number: i + 1,
                  reps: prefillReps,
                  weight_kg: prefillWeight,
                }),
              })
              const setData = await setRes.json()
              sets.push({
                id: setData.id,
                set_number: i + 1,
                reps: prefillReps,
                weight_kg: prefillWeight,
              })
            }

            setExercises(prev => [...prev, {
              id: weData.id,
              exercise_name: te.exercise_name,
              muscle_group: te.muscle_group,
              sets,
              last_session: lastSets,
            }])
          }
        }
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load custom exercises
  useEffect(() => {
    fetch("/api/custom-exercises").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCustomExercises(data)
    })
  }, [])

  // Workout timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [startTime])

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  // Rest timer
  function startRestTimer(seconds?: number) {
    const duration = seconds ?? restDuration
    setRestRemaining(duration)
    if (restTimerRef.current) clearInterval(restTimerRef.current)
    restTimerRef.current = setInterval(() => {
      setRestRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(restTimerRef.current!)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  function cancelRestTimer() {
    if (restTimerRef.current) clearInterval(restTimerRef.current)
    setRestRemaining(null)
  }

  // Total volume
  const totalVolume = exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((setTotal, set) => {
      return setTotal + (Number(set.weight_kg) || 0) * (Number(set.reps) || 0)
    }, 0)
  }, 0)

  function handleSearchInput(value: string) {
    setSearchQuery(value)
    setSelectedBodyPart(null)
    if (searchRef.current) clearTimeout(searchRef.current)
    if (value.length < 2) { setSearchResults([]); return }

    searchRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/exercises/search?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  async function selectBodyPart(part: string) {
    handleSearchInput(part)
  }

  async function addExercise(exercise: { name: string; target?: string; bodyPart?: string; muscle_group?: string }) {
    if (!workoutId) return
    const muscle = exercise.target || exercise.muscle_group || "other"

    const weRes = await fetch("/api/workout-exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workout_id: workoutId,
        exercise_name: exercise.name,
        muscle_group: muscle,
        order_index: exercises.length,
      }),
    })
    const weData = await weRes.json()

    const lastRes = await fetch(`/api/exercises/last-sets?name=${encodeURIComponent(exercise.name)}`)
    const lastSets = await lastRes.json()

    if (templateId) {
      await fetch("/api/template-exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          exercise_name: exercise.name,
          muscle_group: muscle,
          order_index: exercises.length,
        }),
      })
    }

    setExercises(prev => [...prev, {
      id: weData.id,
      exercise_name: exercise.name,
      muscle_group: muscle,
      sets: [],
      last_session: Array.isArray(lastSets) ? lastSets : [],
    }])

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
    setCustomExercises(prev => [...prev, data])
    await addExercise({ name: data.name, muscle_group: data.muscle_group })
    setCustomName("")
    setCustomMuscle("")
    setShowCustomForm(false)
  }

  async function removeExercise(workoutExerciseId: string) {
    if (!confirm("Remove this exercise?")) return
    await fetch(`/api/workout-exercises/${workoutExerciseId}`, { method: "DELETE" })
    setExercises(prev => prev.filter(e => e.id !== workoutExerciseId))
  }

  function toggleSetComplete(workoutExerciseId: string, setId: string) {
    setExercises(prev => prev.map(e =>
      e.id === workoutExerciseId
        ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, completed: !s.completed } : s) }
        : e
    ))
    startRestTimer()
  }

  async function addSet(workoutExerciseId: string) {
    const exercise = exercises.find(e => e.id === workoutExerciseId)
    if (!exercise) return
    const setNumber = exercise.sets.length + 1
    const lastSet = exercise.sets[exercise.sets.length - 1]
  
    const prefillReps = Number(lastSet?.reps) || 8
    const prefillWeight = Number(lastSet?.weight_kg) || 0
  
    const res = await fetch("/api/exercise-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workout_exercise_id: workoutExerciseId,
        set_number: setNumber,
        reps: prefillReps,
        weight_kg: prefillWeight,
      }),
    })
    const data = await res.json()
  
    setExercises(prev => prev.map(e =>
      e.id === workoutExerciseId
        ? { ...e, sets: [...e.sets, {
            id: data.id,
            set_number: setNumber,
            reps: prefillReps,
            weight_kg: prefillWeight,
          }]}
        : e
    ))
  }

  async function removeSet(workoutExerciseId: string, setId: string) {
    await fetch(`/api/exercise-sets/${setId}`, { method: "DELETE" })
    setExercises(prev => prev.map(e =>
      e.id === workoutExerciseId
        ? { ...e, sets: e.sets.filter(s => s.id !== setId) }
        : e
    ))
  }

  const updateSet = useCallback((workoutExerciseId: string, setId: string, field: "reps" | "weight_kg", value: string) => {
    setExercises(prev => prev.map(e =>
      e.id === workoutExerciseId
        ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, [field]: value === "" ? "" : Number(value) } : s) }
        : e
    ))

    const timerKey = `${setId}-${field}`
    if (saveTimers.current[timerKey]) clearTimeout(saveTimers.current[timerKey])
    saveTimers.current[timerKey] = setTimeout(() => {
      if (value !== "") {
        fetch(`/api/exercise-sets/${setId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: Number(value) }),
        })
      }
    }, 800)
  }, [])

  function adjustSet(workoutExerciseId: string, setId: string, field: "reps" | "weight_kg", delta: number) {
    const exercise = exercises.find(e => e.id === workoutExerciseId)
    const set = exercise?.sets.find(s => s.id === setId)
    if (!set) return
    const current = Number(set[field]) || 0
    const step = field === "weight_kg" ? 2.5 : 1
    const newVal = Math.max(0, current + delta * step)
    updateSet(workoutExerciseId, setId, field, String(newVal))
  }

  async function cancelWorkout() {
    setCancelling(true)
    if (workoutId) {
      await fetch(`/api/workouts/${workoutId}`, { method: "DELETE" })
    }
    router.push("/")
  }

  async function flushSaves() {
    const promises: Promise<Response>[] = []
    exercises.forEach(exercise => {
      exercise.sets.forEach(set => {
        console.log(`Saving set ${set.set_number}: reps=${set.reps} weight=${set.weight_kg} id=${set.id}`)

        const weightKey = `${set.id}-weight_kg`
        const repsKey = `${set.id}-reps`
        if (saveTimers.current[weightKey]) {
          clearTimeout(saveTimers.current[weightKey])
          delete saveTimers.current[weightKey]
        }
        if (saveTimers.current[repsKey]) {
          clearTimeout(saveTimers.current[repsKey])
          delete saveTimers.current[repsKey]
        }
        promises.push(
          fetch(`/api/exercise-sets/${set.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reps: Number(set.reps) || 0,
              weight_kg: Number(set.weight_kg) || 0,
            }),
          })
        )
      })
    })
    await Promise.all(promises)
  }

  async function finishWorkout() {
    console.log("finishing, exercises:", exercises.length, exercises.map(e => e.sets.length))
    if (!workoutId) return
    setFinishing(true)
    setError("")
    const durationMinutes = Math.max(1, Math.floor(elapsed / 60))
    try {
      await flushSaves()

      if (templateId) {
        const tRes = await fetch(`/api/templates/${templateId}`)
        const tData = await tRes.json()
        if (tData.exercises) {
          await Promise.all(
            exercises.map(async (exercise) => {
              const templateExercise = tData.exercises.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (te: any) => te.exercise_name.toLowerCase() === exercise.exercise_name.toLowerCase()
              )
              if (templateExercise && exercise.sets.length !== templateExercise.default_sets) {
                await fetch(`/api/template-exercises/${templateExercise.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ default_sets: exercise.sets.length }),
                })
              }
            })
          )
        }
      }

      await fetch(`/api/workouts/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workoutName, duration_minutes: durationMinutes }),
      })
      router.push("/")
    } catch {
      setError("Something went wrong. Please try again.")
      setFinishing(false)
    }
  }

  const displayedExercises = searchQuery.length >= 2
    ? searchResults
    : selectedBodyPart
    ? bodyPartExercises
    : []

  return (
    <main className="min-h-screen bg-neutral-950 text-white pb-40">
      <div className="max-w-2xl mx-auto p-4">

        {/* Header */}
        <div className="sticky top-0 z-20 bg-neutral-950 flex items-center justify-between py-4 mb-4">          <button
            onClick={cancelWorkout}
            disabled={cancelling}
            className="text-neutral-500 hover:text-red-400 text-sm transition-colors"
          >
            {cancelling ? "Cancelling..." : "✕ Cancel"}
          </button>
          <span className="text-teal-400 font-mono text-lg font-bold">{formatTime(elapsed)}</span>
          <button
            onClick={finishWorkout}
            disabled={finishing || !workoutId}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
          >
            {finishing ? "Saving..." : "Finish"}
          </button>
        </div>

        {/* Workout name */}
        <input
          type="text"
          value={workoutName}
          onChange={e => setWorkoutName(e.target.value)}
          className="w-full text-2xl font-bold bg-transparent border-none outline-none text-white placeholder-neutral-600 mb-4"
          placeholder="Workout name"
        />

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Rest Timer */}
        {/* Rest Timer */}
        <div className="sticky top-14 z-10 bg-neutral-950 pb-2 -mx-4 px-4">  <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-neutral-400">Rest Timer</p>
        {restRemaining !== null ? (
          <p className="text-xl font-bold text-teal-400 font-mono leading-tight">{formatTime(restRemaining)}</p>
        ) : (
          <p className="text-neutral-600 text-xs">Completes a set to start</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {restRemaining !== null && (
          <button
            onClick={cancelRestTimer}
            className="text-xs text-neutral-500 hover:text-red-400 px-2 py-1 rounded bg-neutral-800"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => setShowRestPicker(!showRestPicker)}
          className="text-xs text-teal-400 hover:text-teal-300 border border-teal-700 px-3 py-1.5 rounded-lg font-mono"
        >
          {formatTime(restDuration)}
        </button>
      </div>
    </div>

    {showRestPicker && (
      <div className="mt-2 pt-2 border-t border-neutral-800">
        <div className="flex gap-2 flex-wrap">
          {[60, 90, 120, 180, 240, 300].map(secs => (
            <button
              key={secs}
              onClick={() => { setRestDuration(secs); setShowRestPicker(false) }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                restDuration === secs
                  ? "bg-teal-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {secs < 60 ? `${secs}s` : `${secs / 60}m`}
            </button>
          ))}
          <input
            type="number"
            placeholder="Custom (s)"
            className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-teal-500"
            onBlur={e => {
              const val = Number(e.target.value)
              if (val > 0) { setRestDuration(val); setShowRestPicker(false) }
            }}
          />
        </div>
      </div>
    )}
  </div>
</div>

        {/* Exercises */}
        <div className="space-y-4 mb-6">
          {exercises.map(exercise => (
            <div key={exercise.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">

              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold capitalize">{exercise.exercise_name}</p>
                  <p className="text-teal-400 text-xs capitalize mt-0.5">{exercise.muscle_group}</p>
                </div>
                <button
                  onClick={() => removeExercise(exercise.id)}
                  className="text-neutral-600 hover:text-red-400 text-sm transition-colors"
                >
                  Remove
                </button>
              </div>

              {/* Last session reference */}
              {exercise.last_session && exercise.last_session.length > 0 && (
                <div className="mb-3 px-3 py-2 bg-neutral-800/50 rounded-lg">
                  <p className="text-xs text-neutral-500 mb-1">Last session:</p>
                  <div className="flex gap-3 flex-wrap">
                    {exercise.last_session.map((s, i) => (
                      <span key={i} className="text-xs text-neutral-400">
                        Set {s.set_number}: {s.weight_kg}kg × {s.reps}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sets header */}
              {exercise.sets.length > 0 && (
                <div className="grid grid-cols-12 gap-1 text-xs text-neutral-500 mb-2 px-1">
                  <span className="col-span-1">Set</span>
                  <span className="col-span-4 text-center">Weight (kg)</span>
                  <span className="col-span-4 text-center">Reps</span>
                  <span className="col-span-3"></span>
                </div>
              )}

              {/* Sets */}
              <div className="space-y-2">
                {exercise.sets.map(set => (
                  <div
                    key={set.id}
                    className={`grid grid-cols-12 gap-1 items-center rounded-lg px-1 py-0.5 transition-colors ${
                      set.completed ? "bg-teal-600/10" : ""
                    }`}
                  >
                    <span className={`col-span-1 text-sm font-medium ${set.completed ? "text-teal-400" : "text-neutral-500"}`}>
                      {set.set_number}
                    </span>

                    {/* Weight */}
                    <div className="col-span-4 flex items-center gap-1">
                      <button
                        onClick={() => adjustSet(exercise.id, set.id, "weight_kg", -1)}
                        className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 text-sm flex items-center justify-center"
                      >−</button>
                      <input
                        type="number"
                        value={set.weight_kg}
                        onChange={e => updateSet(exercise.id, set.id, "weight_kg", e.target.value)}
                        onFocus={e => e.target.select()}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1 py-1.5 text-sm text-center focus:outline-none focus:border-teal-500 min-w-0"
                        placeholder="0"
                      />
                      <button
                        onClick={() => adjustSet(exercise.id, set.id, "weight_kg", 1)}
                        className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 text-sm flex items-center justify-center"
                      >+</button>
                    </div>

                    {/* Reps */}
                    <div className="col-span-4 flex items-center gap-1">
                      <button
                        onClick={() => adjustSet(exercise.id, set.id, "reps", -1)}
                        className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 text-sm flex items-center justify-center"
                      >−</button>
                      <input
                        type="number"
                        value={set.reps}
                        onChange={e => updateSet(exercise.id, set.id, "reps", e.target.value)}
                        onFocus={e => e.target.select()}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1 py-1.5 text-sm text-center focus:outline-none focus:border-teal-500 min-w-0"
                        placeholder="0"
                      />
                      <button
                        onClick={() => adjustSet(exercise.id, set.id, "reps", 1)}
                        className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 text-sm flex items-center justify-center"
                      >+</button>
                    </div>

                    {/* Checkmark + Delete */}
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleSetComplete(exercise.id, set.id)}
                        className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-colors ${
                          set.completed
                            ? "bg-teal-600 text-white"
                            : "bg-neutral-800 text-neutral-600 hover:text-teal-400 hover:bg-neutral-700"
                        }`}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => removeSet(exercise.id, set.id)}
                        className="w-6 h-7 text-neutral-600 hover:text-red-400 transition-colors text-xs flex items-center justify-center"
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addSet(exercise.id)}
                className="mt-3 w-full py-2 rounded-lg border border-neutral-700 border-dashed text-neutral-400 hover:text-teal-400 hover:border-teal-700 text-sm transition-colors"
              >
                + Add Set
              </button>
            </div>
          ))}
        </div>

        {/* Add Exercise */}
        <button
          onClick={() => setShowSearch(true)}
          className="w-full py-3 rounded-xl border border-neutral-800 border-dashed text-neutral-400 hover:text-teal-400 hover:border-teal-800 transition-colors"
        >
          + Add Exercise
        </button>

        {/* Total volume footer */}
        {totalVolume > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <span className="text-neutral-400 text-sm">Total Volume</span>
              <span className="text-white font-bold">{totalVolume.toLocaleString()} kg</span>
            </div>
          </div>
        )}

        {/* Exercise Search Panel */}
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
                    onClick={() => {
                      setShowSearch(false)
                      setSearchQuery("")
                      setSearchResults([])
                      setSelectedBodyPart(null)
                      setBodyPartExercises([])
                      setShowCustomForm(false)
                    }}
                    className="text-neutral-500 hover:text-white text-sm"
                  >
                    Cancel
                  </button>
                </div>

                {/* Body part pills */}
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

                {/* Custom exercises */}
                {!searchQuery && !selectedBodyPart && customExercises.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-neutral-500 px-3 py-1">My Custom Exercises</p>
                    {customExercises.map(ex => (
                      <button
                        key={ex.id}
                        onClick={() => addExercise({ name: ex.name, muscle_group: ex.muscle_group })}
                        className="w-full text-left p-3 rounded-lg hover:bg-neutral-800 transition-colors"
                      >
                        <p className="capitalize font-medium text-sm">{ex.name}</p>
                        <p className="text-xs text-teal-400 capitalize mt-0.5">{ex.muscle_group} · custom</p>
                      </button>
                    ))}
                    <div className="border-t border-neutral-800 my-2" />
                  </div>
                )}

                {(searching || loadingBodyPart) && (
                  <p className="text-neutral-500 text-sm text-center py-6">Loading...</p>
                )}

                {!searching && !loadingBodyPart && !searchQuery && !selectedBodyPart && customExercises.length === 0 && (
                  <p className="text-neutral-500 text-sm text-center py-4">
                    Search above or pick a body part
                  </p>
                )}

                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-neutral-500 text-sm text-center py-6">No exercises found</p>
                )}

                {displayedExercises.map(exercise => (
                  <button
                    type="button"
                    key={exercise.id}
                    onClick={() => addExercise(exercise)}
                    className="w-full text-left p-3 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    <p className="capitalize font-medium text-sm">{exercise.name}</p>
                    <p className="text-xs text-teal-400 capitalize mt-0.5">
                      {exercise.target} · {exercise.bodyPart}
                    </p>
                  </button>
                ))}

                {/* Create custom exercise */}
                <div className="border-t border-neutral-800 mt-2 pt-2">
                  {!showCustomForm ? (
                    <button
                      onClick={() => setShowCustomForm(true)}
                      className="w-full text-left p-3 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-teal-400 text-sm"
                    >
                      + Create custom exercise
                    </button>
                  ) : (
                    <div className="p-3 space-y-2">
                      <p className="text-sm font-medium text-neutral-300">Custom Exercise</p>
                      <input
                        type="text"
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        placeholder="Exercise name"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                      />
                      <input
                        type="text"
                        value={customMuscle}
                        onChange={e => setCustomMuscle(e.target.value)}
                        placeholder="Muscle group (e.g. chest)"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addCustomExercise}
                          disabled={!customName.trim()}
                          className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowCustomForm(false)}
                          className="flex-1 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-sm"
                        >
                          Cancel
                        </button>
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
