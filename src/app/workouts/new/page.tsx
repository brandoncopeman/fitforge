import { Suspense } from "react"
import NewWorkoutPageInner from "./NewWorkoutPageInner"

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <p className="text-neutral-400">Loading workout...</p>
      </main>
    }>
      <NewWorkoutPageInner />
    </Suspense>
  )
}