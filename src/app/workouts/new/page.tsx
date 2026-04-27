import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import NewWorkoutPageInner from "./NewWorkoutPageInner"
import { loadTemplateData } from "./load-template"

export default async function NewWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>
}) {
  const { userId } = await auth()
  const { template: templateId } = await searchParams

  let templateData = null
  if (templateId && userId) {
    templateData = await loadTemplateData(templateId, userId)
  }

  return (
    <Suspense fallback={
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <p className="text-neutral-400">Loading workout...</p>
      </main>
    }>
      <NewWorkoutPageInner
        templateId={templateId || null}
        templateData={templateData}
      />
    </Suspense>
  )
}