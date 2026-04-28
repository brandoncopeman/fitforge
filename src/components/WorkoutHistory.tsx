"use client"

import { useState } from "react"
import Link from "next/link"

type Workout = {
  id: string
  name: string
  performed_at: string
  duration_minutes: number | null
  exercise_count: number
}

export default function WorkoutHistory({ initialWorkouts }: { initialWorkouts: Workout[] }) {
  const [workouts, setWorkouts] = useState(initialWorkouts)

  async function deleteWorkout(id: string) {
    if (!confirm("Delete this workout?")) return
    setWorkouts(prev => prev.filter(w => w.id !== id))
    fetch(`/api/workouts/${id}`, { method: "DELETE" })
  }

  if (workouts.length === 0) {
    return (
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 text-center">
        <p className="text-neutral-400">No workouts logged yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {workouts.map(workout => (
        <div key={workout.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex items-center gap-3">
          <Link href={`/workouts/${workout.id}`} className="flex-1 min-w-0">
            <p className="font-medium truncate">{workout.name}</p>
            <p className="text-neutral-400 text-sm mt-0.5">
              {new Date(workout.performed_at).toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric"
              })}
              {workout.duration_minutes && ` · ${workout.duration_minutes} min`}
            </p>
            <p className="text-neutral-500 text-xs mt-0.5">{workout.exercise_count} exercises</p>
          </Link>
          <button
            onClick={() => deleteWorkout(workout.id)}
            className="text-neutral-600 hover:text-red-400 transition-colors text-xs flex-shrink-0 border border-neutral-700 hover:border-red-800 px-2 py-1 rounded-lg"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}