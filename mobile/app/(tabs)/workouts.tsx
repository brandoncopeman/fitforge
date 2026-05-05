import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { router } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"
import {
  setCachedActiveWorkout,
  setCachedActiveWorkoutForId,
} from "@/lib/activeWorkoutCache"
import {
  createMobileTemplate,
  getMobileTemplates,
  setMobileNextTemplate,
  startMobileWorkout,
  updateMobileTemplatePlanStatus,
} from "@/lib/api"
import { buildDraftWorkoutFromTemplate } from "@/lib/draftWorkout"
import {
  MobileTemplatesResponse,
  MobileWorkoutTemplate,
} from "@/types/workouts"

const EMPTY_DATA: MobileTemplatesResponse = {
  templates: [],
  plan: {
    lastPlanIndex: -1,
    nextPlanIndex: -1,
    nextTemplate: null,
  },
}

function triggerMediumHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  }
}

function triggerLightHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

function formatExerciseCount(count: number) {
  return `${count} exercise${count === 1 ? "" : "s"}`
}

function normalizeTemplatesResponse(
  response: MobileTemplatesResponse | null
): MobileTemplatesResponse {
  return {
    templates: Array.isArray(response?.templates) ? response.templates : [],
    plan: {
      lastPlanIndex: response?.plan?.lastPlanIndex ?? -1,
      nextPlanIndex: response?.plan?.nextPlanIndex ?? -1,
      nextTemplate: response?.plan?.nextTemplate ?? null,
    },
  }
}

function sortPlanTemplates(templates: MobileWorkoutTemplate[]) {
  return [...templates]
    .filter((template) => template.in_plan)
    .sort(
      (a, b) =>
        Number(a.plan_order ?? 9999) - Number(b.plan_order ?? 9999)
    )
}

export default function WorkoutsScreen() {
  const { getToken } = useAuth()

  const [data, setData] = useState<MobileTemplatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(
    null
  )
  const [selectedTemplate, setSelectedTemplate] =
    useState<MobileWorkoutTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)

  const localMutationAtRef = useRef(0)
  const latestLoadStartedAtRef = useRef(0)

  const currentData = useMemo(() => normalizeTemplatesResponse(data), [data])

  const templates = useMemo(() => currentData.templates, [currentData.templates])

  const planTemplates = useMemo(() => sortPlanTemplates(templates), [templates])

  const otherTemplates = useMemo(
    () => templates.filter((template) => !template.in_plan),
    [templates]
  )

  const nextTemplate = currentData.plan.nextTemplate

  const markLocalMutation = useCallback(() => {
    localMutationAtRef.current = Date.now()
  }, [])

  const loadTemplates = useCallback(
    async (isRefresh = false) => {
      const requestStartedAt = Date.now()
      latestLoadStartedAtRef.current = requestStartedAt

      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError(null)

        const templatesResponse = await getMobileTemplates(getToken)

        const localChangedAfterRequest =
          localMutationAtRef.current > requestStartedAt

        const newerRequestStarted =
          latestLoadStartedAtRef.current > requestStartedAt

        if (localChangedAfterRequest || newerRequestStarted) {
          return
        }

        setData(normalizeTemplatesResponse(templatesResponse))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workouts")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getToken]
  )

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  function getLastPlanIndexForNextFromPlan(
    templateId: string,
    plan: MobileWorkoutTemplate[]
  ) {
    const desiredIndex = plan.findIndex((template) => template.id === templateId)

    if (desiredIndex === -1 || plan.length === 0) {
      return currentData.plan.lastPlanIndex ?? -1
    }

    return desiredIndex === 0 ? plan.length - 1 : desiredIndex - 1
  }

  function handleSetNextTemplate(template: MobileWorkoutTemplate) {
    triggerLightHaptic()
    markLocalMutation()

    const previousData = data

    setData((current) => {
      const safeCurrent = normalizeTemplatesResponse(current)
      const safeTemplates = safeCurrent.templates
      const safePlan = sortPlanTemplates(safeTemplates)

      const freshTemplate =
        safeTemplates.find((item) => item.id === template.id) ?? template

      const optimisticLastPlanIndex = getLastPlanIndexForNextFromPlan(
        template.id,
        safePlan
      )

      const optimisticNextPlanIndex = safePlan.findIndex(
        (item) => item.id === template.id
      )

      return {
        ...safeCurrent,
        plan: {
          lastPlanIndex: optimisticLastPlanIndex,
          nextPlanIndex: optimisticNextPlanIndex,
          nextTemplate: freshTemplate,
        },
      }
    })

    setMobileNextTemplate(getToken, template.id).catch((err: unknown) => {
      console.warn("Failed to set next workout", err)

      if (previousData) {
        setData(previousData)
      }
    })
  }

  function handleAddToPlan(template: MobileWorkoutTemplate) {
    triggerLightHaptic()
    markLocalMutation()

    const previousData = data

    setData((current) => {
      const safeCurrent = normalizeTemplatesResponse(current)
      const safeTemplates = safeCurrent.templates
      const nextPlanOrder = sortPlanTemplates(safeTemplates).length

      const nextTemplates = safeTemplates.map((item) =>
        item.id === template.id
          ? {
              ...item,
              in_plan: true,
              plan_order: nextPlanOrder,
            }
          : item
      )

      const nextPlanTemplates = sortPlanTemplates(nextTemplates)
      const currentNextStillInPlan =
        safeCurrent.plan.nextTemplate &&
        nextPlanTemplates.some(
          (item) => item.id === safeCurrent.plan.nextTemplate?.id
        )

      const nextTemplateValue = currentNextStillInPlan
        ? safeCurrent.plan.nextTemplate
        : nextPlanTemplates[0] ?? null

      return {
        ...safeCurrent,
        templates: nextTemplates,
        plan: {
          ...safeCurrent.plan,
          nextTemplate: nextTemplateValue,
          nextPlanIndex: nextTemplateValue
            ? nextPlanTemplates.findIndex(
                (item) => item.id === nextTemplateValue.id
              )
            : -1,
        },
      }
    })

    updateMobileTemplatePlanStatus(getToken, template.id, {
      in_plan: true,
      plan_order: planTemplates.length,
    }).catch((err: unknown) => {
      console.warn("Failed to add to plan", err)

      if (previousData) {
        setData(previousData)
      }
    })
  }

  function handleRemoveFromPlan(template: MobileWorkoutTemplate) {
    triggerLightHaptic()
    markLocalMutation()

    const previousData = data

    setData((current) => {
      const safeCurrent = normalizeTemplatesResponse(current)

      const nextTemplates = safeCurrent.templates.map((item) =>
        item.id === template.id
          ? {
              ...item,
              in_plan: false,
              plan_order: null,
            }
          : item
      )

      const nextPlanTemplates = sortPlanTemplates(nextTemplates)
      const removedWasNext = safeCurrent.plan.nextTemplate?.id === template.id
      const replacementNext = removedWasNext
        ? nextPlanTemplates[0] ?? null
        : safeCurrent.plan.nextTemplate

      return {
        ...safeCurrent,
        templates: nextTemplates,
        plan: {
          ...safeCurrent.plan,
          nextTemplate: replacementNext,
          nextPlanIndex: replacementNext
            ? nextPlanTemplates.findIndex(
                (item) => item.id === replacementNext.id
              )
            : -1,
        },
      }
    })

    updateMobileTemplatePlanStatus(getToken, template.id, {
      in_plan: false,
      plan_order: null,
    }).catch((err: unknown) => {
      console.warn("Failed to remove from plan", err)

      if (previousData) {
        setData(previousData)
      }
    })
  }

  function movePlanTemplate(template: MobileWorkoutTemplate, direction: -1 | 1) {
    const currentIndex = planTemplates.findIndex(
      (item) => item.id === template.id
    )
    const nextIndex = currentIndex + direction

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= planTemplates.length) {
      return
    }

    triggerLightHaptic()
    markLocalMutation()

    const previousData = data
    const reordered = [...planTemplates]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, moved)

    setData((current) => {
      const safeCurrent = normalizeTemplatesResponse(current)

      const nextTemplates = safeCurrent.templates.map((item) => {
        const orderIndex = reordered.findIndex(
          (planItem) => planItem.id === item.id
        )

        if (orderIndex === -1) return item

        return {
          ...item,
          plan_order: orderIndex,
        }
      })

      const nextPlanTemplates = sortPlanTemplates(nextTemplates)
      const nextTemplateValue = safeCurrent.plan.nextTemplate
        ? nextPlanTemplates.find(
            (item) => item.id === safeCurrent.plan.nextTemplate?.id
          ) ?? null
        : null

      return {
        ...safeCurrent,
        templates: nextTemplates,
        plan: {
          ...safeCurrent.plan,
          nextTemplate: nextTemplateValue,
          nextPlanIndex: nextTemplateValue
            ? nextPlanTemplates.findIndex(
                (item) => item.id === nextTemplateValue.id
              )
            : -1,
        },
      }
    })

    Promise.all(
      reordered.map((item, index) =>
        updateMobileTemplatePlanStatus(getToken, item.id, {
          plan_order: index,
        })
      )
    ).catch((err: unknown) => {
      console.warn("Failed to reorder plan", err)

      if (previousData) {
        setData(previousData)
      }
    })
  }

  async function handleCreateTemplate() {
    try {
      triggerMediumHaptic()
      markLocalMutation()

      const template = await createMobileTemplate(getToken, "New Template")

      setData((current) => {
        const safeCurrent = normalizeTemplatesResponse(current)

        return {
          ...safeCurrent,
          templates: [
            {
              ...template,
              exercise_count: template.exercise_count ?? 0,
              exercises: template.exercises ?? [],
              lastSetsByExercise: template.lastSetsByExercise ?? {},
            },
            ...safeCurrent.templates,
          ],
        }
      })

      router.push({
        pathname: "/template/[id]",
        params: {
          id: template.id,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template")
    }
  }

  function handleStartWorkout(template: MobileWorkoutTemplate) {
    if (startingTemplateId) return

    const draftWorkout = buildDraftWorkoutFromTemplate({
      template,
      startedFromQueuedTemplate: template.id === nextTemplate?.id,
    })

    triggerMediumHaptic()
    setError(null)
    setSelectedTemplate(null)
    setStartingTemplateId(template.id)

    setCachedActiveWorkout(draftWorkout)

    router.push({
      pathname: "/workout/[id]",
      params: {
        id: draftWorkout.workout.id,
      },
    })

    startMobileWorkout(getToken, template.id)
      .then((realWorkout) => {
        setCachedActiveWorkoutForId(draftWorkout.workout.id, realWorkout)
        setCachedActiveWorkout(realWorkout)
      })
      .catch((err: unknown) => {
        console.warn("Failed to save workout in background", err)
      })
      .finally(() => {
        setStartingTemplateId(null)
      })
  }

  function openTemplateActions(template: MobileWorkoutTemplate) {
    triggerLightHaptic()
    setSelectedTemplate(template)
  }

  function editTemplate(template: MobileWorkoutTemplate) {
    setSelectedTemplate(null)

    router.push({
      pathname: "/template/[id]",
      params: {
        id: template.id,
      },
    })
  }

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading workouts...</Text>
      </SafeAreaView>
    )
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <Text style={styles.errorTitle}>Couldn’t load workouts</Text>
        <Text selectable style={styles.errorText}>
          {error}
        </Text>

        <FitCard accent onPress={() => loadTemplates()}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </FitCard>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTemplates(true)}
            tintColor={colors.teal}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Workout</Text>
            <Text style={styles.subtitle}>Start or manage your plan.</Text>
          </View>

          <View style={styles.templateCountPill}>
            <Text style={styles.templateCountText}>{templates.length}</Text>
          </View>
        </View>

        {error ? (
          <FitCard>
            <Text selectable style={styles.inlineError}>
              {error}
            </Text>
          </FitCard>
        ) : null}

        <FitCard accent>
          <Text style={styles.eyebrow}>
            {nextTemplate ? "Ready next" : "No next workout"}
          </Text>

          <Text style={styles.heroTitle}>
            {nextTemplate?.name ?? "Start fresh"}
          </Text>

          <Text style={styles.heroDetail}>
            {nextTemplate
              ? formatExerciseCount(nextTemplate.exercise_count)
              : "Add templates to your plan first"}
          </Text>

          <Pressable
            onPress={() => {
              if (nextTemplate) {
                handleStartWorkout(nextTemplate)
              }
            }}
            disabled={!nextTemplate || Boolean(startingTemplateId)}
            style={({ pressed }) => [
              styles.startButton,
              pressed && !startingTemplateId ? styles.startButtonPressed : null,
              !nextTemplate || startingTemplateId
                ? styles.startButtonDisabled
                : null,
            ]}
          >
            {startingTemplateId === nextTemplate?.id ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Ionicons name="play" size={20} color={colors.background} />
                <Text style={styles.startButtonText}>Start Workout</Text>
              </>
            )}
          </Pressable>
        </FitCard>

        <Pressable
          onPress={handleCreateTemplate}
          style={({ pressed }) => [
            styles.createButton,
            pressed ? styles.startButtonPressed : null,
          ]}
        >
          <Ionicons name="add" size={19} color={colors.teal} />
          <Text style={styles.createButtonText}>Create Template</Text>
        </Pressable>

        <SectionTitle
          title="Workout plan"
          detail={`${planTemplates.length} queued`}
        />

        {planTemplates.length > 0 ? (
          planTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index}
              isNext={template.id === nextTemplate?.id}
              isStarting={startingTemplateId === template.id}
              isFirst={index === 0}
              isLast={index === planTemplates.length - 1}
              onPress={() => openTemplateActions(template)}
              onSetNext={() => handleSetNextTemplate(template)}
              onMoveUp={() => movePlanTemplate(template, -1)}
              onMoveDown={() => movePlanTemplate(template, 1)}
              onRemove={() => handleRemoveFromPlan(template)}
            />
          ))
        ) : (
          <EmptyCard text="No templates in your workout plan yet." />
        )}

        {otherTemplates.length > 0 && (
          <>
            <SectionTitle
              title="Other templates"
              detail={`${otherTemplates.length} saved`}
            />

            {otherTemplates.map((template) => (
              <OtherTemplateCard
                key={template.id}
                template={template}
                onPress={() => openTemplateActions(template)}
                onAddToPlan={() => handleAddToPlan(template)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <TemplateActionModal
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onStart={() => {
          if (selectedTemplate) {
            handleStartWorkout(selectedTemplate)
          }
        }}
        onEdit={() => {
          if (selectedTemplate) {
            editTemplate(selectedTemplate)
          }
        }}
      />
    </SafeAreaView>
  )
}

function SectionTitle({
  title,
  detail,
}: {
  title: string
  detail: string
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDetail}>{detail}</Text>
    </View>
  )
}

function TemplateCard({
  template,
  index,
  isNext,
  isStarting,
  isFirst,
  isLast,
  onPress,
  onSetNext,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  template: MobileWorkoutTemplate
  index: number
  isNext: boolean
  isStarting: boolean
  isFirst: boolean
  isLast: boolean
  onPress: () => void
  onSetNext: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  return (
    <FitCard
      style={[styles.templateCard, isNext && styles.nextTemplateCard]}
      onPress={onPress}
    >
      <View style={styles.templateRow}>
        <View style={[styles.templateNumber, isNext && styles.nextNumber]}>
          <Text
            style={[styles.templateNumberText, isNext && styles.nextNumberText]}
          >
            {index + 1}
          </Text>
        </View>

        <View style={styles.templateBody}>
          <View style={styles.templateTitleRow}>
            <Text style={styles.templateName}>{template.name}</Text>

            {isNext ? (
              <View style={styles.nextPill}>
                <Text style={styles.nextPillText}>Next</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.templateDetail}>
            {formatExerciseCount(template.exercise_count)}
          </Text>
        </View>

        {isStarting ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <View style={styles.cardActions}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation()
                onSetNext()
              }}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>Next</Text>
            </Pressable>

            <Pressable
              onPress={(event) => {
                event.stopPropagation()
                onMoveUp()
              }}
              disabled={isFirst}
              style={[styles.iconButton, isFirst && styles.disabledIconButton]}
            >
              <Ionicons name="chevron-up" size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={(event) => {
                event.stopPropagation()
                onMoveDown()
              }}
              disabled={isLast}
              style={[styles.iconButton, isLast && styles.disabledIconButton]}
            >
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={(event) => {
                event.stopPropagation()
                onRemove()
              }}
              style={styles.iconButton}
            >
              <Ionicons name="remove" size={17} color={colors.red} />
            </Pressable>
          </View>
        )}
      </View>
    </FitCard>
  )
}

function OtherTemplateCard({
  template,
  onPress,
  onAddToPlan,
}: {
  template: MobileWorkoutTemplate
  onPress: () => void
  onAddToPlan: () => void
}) {
  return (
    <FitCard style={styles.templateCard} onPress={onPress}>
      <View style={styles.templateRow}>
        <View style={styles.templateBody}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateDetail}>
            {formatExerciseCount(template.exercise_count)}
          </Text>
        </View>

        <Pressable
          onPress={(event) => {
            event.stopPropagation()
            onAddToPlan()
          }}
          style={styles.smallButton}
        >
          <Text style={styles.smallButtonText}>+ Plan</Text>
        </Pressable>

        <Ionicons name="chevron-forward" size={21} color={colors.textMuted} />
      </View>
    </FitCard>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <FitCard>
      <Text style={styles.emptyText}>{text}</Text>
    </FitCard>
  )
}

function TemplateActionModal({
  template,
  onClose,
  onStart,
  onEdit,
}: {
  template: MobileWorkoutTemplate | null
  onClose: () => void
  onStart: () => void
  onEdit: () => void
}) {
  return (
    <Modal
      visible={Boolean(template)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <Text style={styles.modalTitle}>{template?.name}</Text>
          <Text style={styles.modalSubtitle}>
            {formatExerciseCount(template?.exercise_count ?? 0)}
          </Text>

          <Pressable style={styles.modalPrimaryButton} onPress={onStart}>
            <Ionicons name="play" size={19} color={colors.background} />
            <Text style={styles.modalPrimaryButtonText}>Start Workout</Text>
          </Pressable>

          <Pressable style={styles.modalSecondaryButton} onPress={onEdit}>
            <Ionicons name="create-outline" size={19} color={colors.text} />
            <Text style={styles.modalSecondaryButtonText}>Edit Template</Text>
          </Pressable>

          <Pressable style={styles.modalCancelButton} onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 130,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  inlineError: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  retryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  header: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 280,
  },
  templateCountPill: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  templateCountText: {
    color: colors.teal,
    fontSize: 17,
    fontWeight: "900",
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    textTransform: "capitalize",
    marginTop: 4,
  },
  heroDetail: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  startButton: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  startButtonDisabled: {
    opacity: 0.55,
  },
  startButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  createButton: {
    minHeight: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  createButtonText: {
    color: colors.teal,
    fontSize: 15,
    fontWeight: "900",
  },
  sectionHeader: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionDetail: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  templateCard: {
    padding: spacing.md,
  },
  nextTemplateCard: {
    borderColor: colors.borderStrong,
  },
  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  templateNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextNumber: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
  },
  templateNumberText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
  },
  nextNumberText: {
    color: colors.teal,
  },
  templateBody: {
    flex: 1,
  },
  templateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  templateName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  templateDetail: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  nextPill: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nextPillText: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  smallButton: {
    minHeight: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  smallButtonText: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: "900",
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledIconButton: {
    opacity: 0.3,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: -8,
  },
  modalPrimaryButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalPrimaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  modalSecondaryButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalSecondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  modalCancelButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "800",
  },
})