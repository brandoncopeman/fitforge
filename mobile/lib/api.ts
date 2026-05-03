import { MobileHomeResponse } from "@/types/home"
import { MobileTemplatesResponse } from "@/types/workouts"

const API_BASE_URL = "https://myfitforge.vercel.app"

type GetToken = () => Promise<string | null>

async function apiFetch<T>(path: string, getToken: GetToken): Promise<T> {
  const token = await getToken()

  if (!token) {
    throw new Error("No Clerk session token found. Please sign in again.")
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
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