import { MobileActiveWorkoutResponse } from "@/types/activeWorkout"

const activeWorkoutCache = new Map<string, MobileActiveWorkoutResponse>()
const listeners = new Map<string, Set<(workout: MobileActiveWorkoutResponse) => void>>()

export function setCachedActiveWorkout(workout: MobileActiveWorkoutResponse) {
  activeWorkoutCache.set(workout.workout.id, workout)
  notifyWorkoutListeners(workout.workout.id, workout)
}

export function setCachedActiveWorkoutForId(
  cacheId: string,
  workout: MobileActiveWorkoutResponse
) {
  activeWorkoutCache.set(cacheId, workout)
  notifyWorkoutListeners(cacheId, workout)
}

export function getCachedActiveWorkout(workoutId: string) {
  return activeWorkoutCache.get(workoutId) ?? null
}

export function clearCachedActiveWorkout(workoutId: string) {
  activeWorkoutCache.delete(workoutId)
  listeners.delete(workoutId)
}

export function subscribeToCachedActiveWorkout(
  workoutId: string,
  callback: (workout: MobileActiveWorkoutResponse) => void
) {
  const currentListeners = listeners.get(workoutId) ?? new Set()
  currentListeners.add(callback)
  listeners.set(workoutId, currentListeners)

  return () => {
    const nextListeners = listeners.get(workoutId)

    if (!nextListeners) return

    nextListeners.delete(callback)

    if (nextListeners.size === 0) {
      listeners.delete(workoutId)
    } else {
      listeners.set(workoutId, nextListeners)
    }
  }
}

function notifyWorkoutListeners(
  workoutId: string,
  workout: MobileActiveWorkoutResponse
) {
  const currentListeners = listeners.get(workoutId)

  if (!currentListeners) return

  currentListeners.forEach((listener) => {
    listener(workout)
  })
}