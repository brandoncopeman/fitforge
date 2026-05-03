import { MobileHomeResponse } from "@/types/home"
import { MobileTemplatesResponse } from "@/types/workouts"

const API_BASE_URL = "https://myfitforge.vercel.app"
const MOBILE_PREVIEW_SECRET = "fitforge-mobile-preview-2026-super-secret"

async function apiFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "x-mobile-preview-secret": MOBILE_PREVIEW_SECRET,
      },
    })
  
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(text || `Request failed: ${res.status}`)
    }
  
    return res.json()
  }
  
  export async function getMobileHome(): Promise<MobileHomeResponse> {
    return apiFetch<MobileHomeResponse>("/api/mobile/home")
  }
  
  export async function getMobileTemplates(): Promise<MobileTemplatesResponse> {
    return apiFetch<MobileTemplatesResponse>("/api/mobile/templates")
  }