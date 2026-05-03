import { MobileHomeResponse } from "@/types/home"

const API_BASE_URL = "https://myfitforge.vercel.app"
const MOBILE_PREVIEW_SECRET = "fitforge-mobile-preview-2026-super-secret"

export async function getMobileHome(): Promise<MobileHomeResponse> {
    const res = await fetch(`${API_BASE_URL}/api/mobile/home`, {
      headers: {
        "x-mobile-preview-secret": MOBILE_PREVIEW_SECRET,
      },
    })
  
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(text || `Failed to fetch home data: ${res.status}`)
    }
  
    return res.json()
  }