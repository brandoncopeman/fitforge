import { MobileWorkoutTemplate } from "@/types/workouts"

const DRAFT_TEMPLATE_PREFIX = "draft-template-"
const draftTemplates = new Map<string, MobileWorkoutTemplate>()

function makeDraftTemplateId() {
  return `${DRAFT_TEMPLATE_PREFIX}${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

export function isDraftTemplateId(id: string | null | undefined) {
  return Boolean(id?.startsWith(DRAFT_TEMPLATE_PREFIX))
}

export function createDraftTemplate() {
  const now = new Date().toISOString()

  const draftTemplate = {
    id: makeDraftTemplateId(),
    user_id: "local-draft",
    name: "",
    in_plan: false,
    plan_order: null,
    created_at: now,
    exercise_count: 0,
    exercises: [],
    lastSetsByExercise: {},
  } as MobileWorkoutTemplate

  draftTemplates.set(draftTemplate.id, draftTemplate)
  return draftTemplate
}

export function getDraftTemplate(id: string | null | undefined) {
  if (!id) return null
  return draftTemplates.get(id) ?? null
}

export function setDraftTemplate(template: MobileWorkoutTemplate) {
  if (!isDraftTemplateId(template.id)) return
  draftTemplates.set(template.id, template)
}

export function deleteDraftTemplate(id: string | null | undefined) {
  if (!id) return
  draftTemplates.delete(id)
}
