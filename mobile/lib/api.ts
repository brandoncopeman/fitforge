import {
  MobileActiveWorkoutResponse,
  MobileExerciseSet,
  MobileWorkout,
  MobileWorkoutExercise,
} from "@/types/activeWorkout"
import { MobileHomeResponse } from "@/types/home"
import { MobileTemplatesResponse, MobileWorkoutTemplate } from "@/types/workouts"


const API_BASE_URL = "https://myfitforge.vercel.app"

type GetToken = () => Promise<string | null>

export type MobileExerciseSearchResult = {
  id: string
  name: string
  bodyPart?: string
  target?: string
  muscle_group?: string
}

export type MobileLastSet = {
  set_number: number
  weight_kg: number | string
  reps: number
}

async function apiFetch<T>(
  path: string,
  getToken: GetToken,
  options?: RequestInit
): Promise<T> {
  const token = await getToken()

  if (!token) {
    throw new Error("No Clerk session token found. Please sign in again.")
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  })

  const text = await res.text().catch(() => "")

  if (!res.ok) {
    throw new Error(text || `Request failed: ${res.status}`)
  }

  if (!text) {
    return {} as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return text as T
  }
}

export async function getMobileHome(
  getToken: GetToken
): Promise<MobileHomeResponse> {
  return apiFetch<MobileHomeResponse>("/api/mobile/home", getToken)
}

export async function getMobileTemplates(
  getToken: GetToken
): Promise<MobileTemplatesResponse> {
  return apiFetch<MobileTemplatesResponse>("/api/mobile/templates", getToken)
}

export async function createMobileTemplate(
  getToken: GetToken,
  name = "New Template"
): Promise<MobileWorkoutTemplate> {
  return apiFetch<MobileWorkoutTemplate>("/api/templates", getToken, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export async function startMobileWorkout(
  getToken: GetToken,
  templateId: string
): Promise<MobileActiveWorkoutResponse> {
  return apiFetch<MobileActiveWorkoutResponse>(
    "/api/mobile/workouts/start",
    getToken,
    {
      method: "POST",
      body: JSON.stringify({
        template_id: templateId,
      }),
    }
  )
}

export async function getMobileWorkout(
  getToken: GetToken,
  workoutId: string
): Promise<MobileActiveWorkoutResponse> {
  return apiFetch<MobileActiveWorkoutResponse>(
    `/api/workouts/${workoutId}`,
    getToken
  )
}

export async function updateMobileWorkout(
  getToken: GetToken,
  workoutId: string,
  body: {
    name?: string
    duration_minutes?: number
    notes?: string
  }
): Promise<MobileWorkout> {
  return apiFetch<MobileWorkout>(`/api/workouts/${workoutId}`, getToken, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deleteMobileWorkout(
  getToken: GetToken,
  workoutId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/workouts/${workoutId}`, getToken, {
    method: "DELETE",
  })
}

export async function addMobileWorkoutExercise(
  getToken: GetToken,
  body: {
    workout_id: string
    exercise_name: string
    exercise_external_id?: string | null
    muscle_group?: string | null
    order_index?: number
  }
): Promise<MobileWorkoutExercise> {
  return apiFetch<MobileWorkoutExercise>("/api/workout-exercises", getToken, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function deleteMobileWorkoutExercise(
  getToken: GetToken,
  workoutExerciseId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/api/workout-exercises/${workoutExerciseId}`,
    getToken,
    {
      method: "DELETE",
    }
  )
}

export async function addMobileExerciseSet(
  getToken: GetToken,
  body: {
    workout_exercise_id: string
    set_number: number
    reps: number
    weight_kg: number
  }
): Promise<MobileExerciseSet> {
  return apiFetch<MobileExerciseSet>("/api/exercise-sets", getToken, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updateMobileExerciseSet(
  getToken: GetToken,
  setId: string,
  body: {
    reps?: number
    weight_kg?: number
  }
): Promise<MobileExerciseSet> {
  return apiFetch<MobileExerciseSet>(`/api/exercise-sets/${setId}`, getToken, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deleteMobileExerciseSet(
  getToken: GetToken,
  setId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/exercise-sets/${setId}`, getToken, {
    method: "DELETE",
  })
}

export async function advanceMobilePlan(
  getToken: GetToken,
  templateId: string
): Promise<{ success: boolean; nextIndex?: number }> {
  return apiFetch<{ success: boolean; nextIndex?: number }>(
    "/api/profile/advance-plan",
    getToken,
    {
      method: "POST",
      body: JSON.stringify({
        template_id: templateId,
      }),
    }
  )
}

export async function searchMobileExercises(
  getToken: GetToken,
  query: string
): Promise<MobileExerciseSearchResult[]> {
  return apiFetch<MobileExerciseSearchResult[]>(
    `/api/exercises/search?q=${encodeURIComponent(query)}`,
    getToken
  )
}

export async function getMobileExerciseLastSets(
  getToken: GetToken,
  exerciseName: string
): Promise<MobileLastSet[]> {
  return apiFetch<MobileLastSet[]>(
    `/api/exercises/last-sets?name=${encodeURIComponent(exerciseName)}`,
    getToken
  )
}

export async function setMobileNextTemplate(
  getToken: GetToken,
  templateId: string
) {
  return apiFetch<{
    success: boolean
    next_template_id: string
    last_plan_index: number
  }>("/api/profile/set-next-template", getToken, {
    method: "POST",
    body: JSON.stringify({
      template_id: templateId,
    }),
  })
}
export async function overwriteMobileTemplateFromWorkout(
  getToken: GetToken,
  templateId: string,
  exercises: {
    exercise_name: string
    muscle_group: string | null
    order_index: number
    default_sets: number
    default_reps: number
    default_weight_kg: number
  }[]
): Promise<MobileWorkoutTemplate> {
  return apiFetch<MobileWorkoutTemplate>(
    `/api/mobile/templates/${templateId}/overwrite-from-workout`,
    getToken,
    {
      method: "POST",
      body: JSON.stringify({
        exercises,
      }),
    }
  )
}
export async function updateMobileTemplatePlanStatus(
  getToken: GetToken,
  templateId: string,
  body: {
    in_plan?: boolean
    plan_order?: number | null
    name?: string
  }
) {
  return apiFetch(`/api/templates/${templateId}`, getToken, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}