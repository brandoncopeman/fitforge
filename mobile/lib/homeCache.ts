import { MobileHomeResponse } from "@/types/home"

let cachedHome: MobileHomeResponse | null = null
let inflightHomePromise: Promise<MobileHomeResponse> | null = null

const listeners = new Set<(data: MobileHomeResponse) => void>()

export function getCachedHome() {
  return cachedHome
}

export function setCachedHome(data: MobileHomeResponse) {
  cachedHome = data

  listeners.forEach((listener) => {
    listener(data)
  })
}

export function subscribeToHomeCache(
  listener: (data: MobileHomeResponse) => void
) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export async function getOrLoadHome(loader: () => Promise<MobileHomeResponse>) {
  if (cachedHome) return cachedHome

  if (!inflightHomePromise) {
    inflightHomePromise = loader()
      .then((data) => {
        setCachedHome(data)
        return data
      })
      .finally(() => {
        inflightHomePromise = null
      })
  }

  return inflightHomePromise
}