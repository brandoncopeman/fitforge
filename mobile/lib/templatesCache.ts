import { MobileTemplatesResponse } from "@/types/workouts"

let cachedTemplates: MobileTemplatesResponse | null = null
let inflightTemplatesPromise: Promise<MobileTemplatesResponse> | null = null

const listeners = new Set<(data: MobileTemplatesResponse) => void>()

export function getCachedTemplates() {
  return cachedTemplates
}

export function setCachedTemplates(data: MobileTemplatesResponse) {
  cachedTemplates = data
  listeners.forEach((listener) => listener(data))
}

export function subscribeToTemplatesCache(
  listener: (data: MobileTemplatesResponse) => void
) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export async function getOrLoadTemplates(
  loader: () => Promise<MobileTemplatesResponse>
) {
  if (cachedTemplates) return cachedTemplates

  if (!inflightTemplatesPromise) {
    inflightTemplatesPromise = loader()
      .then((data) => {
        setCachedTemplates(data)
        return data
      })
      .finally(() => {
        inflightTemplatesPromise = null
      })
  }

  return inflightTemplatesPromise
}