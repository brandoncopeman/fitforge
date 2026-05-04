import { MobileActiveWorkoutResponse } from "@/types/activeWorkout"
import { MobileHomeResponse } from "@/types/home"
import { MobileTemplatesResponse } from "@/types/workouts"

const API_BASE_URL = "https://myfitforge.vercel.app"

type GetToken = () => Promise<string | null>

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

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Request failed: ${res.status}`)
  }

  return res.json()
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