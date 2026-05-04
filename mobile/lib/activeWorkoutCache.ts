import { MobileActiveWorkoutResponse } from "@/types/activeWorkout"

const activeWorkoutCache = new Map<string, MobileActiveWorkoutResponse>()

export function setCachedActiveWorkout(workout: MobileActiveWorkoutResponse) {
  activeWorkoutCache.set(workout.workout.id, workout)
}

export function getCachedActiveWorkout(workoutId: string) {
  return activeWorkoutCache.get(workoutId) ?? null
}

export function clearCachedActiveWorkout(workoutId: string) {
  activeWorkoutCache.delete(workoutId)
}