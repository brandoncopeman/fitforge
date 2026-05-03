import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
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
import { getMobileTemplates } from "@/lib/api"
import {
  MobileTemplatesResponse,
  MobileWorkoutTemplate,
} from "@/types/workouts"

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

export default function WorkoutsScreen() {
  const { getToken } = useAuth()

  const [data, setData] = useState<MobileTemplatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTemplates = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError(null)

        const templates = await getMobileTemplates(getToken)
        setData(templates)
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

  const planTemplates = useMemo(
    () => data?.templates.filter((template) => template.in_plan) ?? [],
    [data]
  )

  const otherTemplates = useMemo(
    () => data?.templates.filter((template) => !template.in_plan) ?? [],
    [data]
  )

  const nextTemplate = data?.plan.nextTemplate ?? null

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
            <Text style={styles.subtitle}>
              Fast native templates and active workout flow
            </Text>
          </View>

          <View style={styles.templateCountPill}>
            <Text style={styles.templateCountText}>
              {data?.templates.length ?? 0}
            </Text>
          </View>
        </View>

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
              : "Create or add templates to your plan"}
          </Text>

          <Pressable
            onPress={triggerMediumHaptic}
            style={({ pressed }) => [
              styles.startButton,
              pressed && styles.startButtonPressed,
            ]}
          >
            <Ionicons name="play" size={20} color={colors.background} />
            <Text style={styles.startButtonText}>
              {nextTemplate ? "Start Workout" : "Empty Workout"}
            </Text>
          </Pressable>
        </FitCard>

        <SectionTitle
          title="Plan templates"
          detail={`${planTemplates.length} in plan`}
        />

        {planTemplates.length > 0 ? (
          planTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index}
              isNext={template.id === nextTemplate?.id}
            />
          ))
        ) : (
          <EmptyCard text="No templates in your plan yet." />
        )}

        {otherTemplates.length > 0 && (
          <>
            <SectionTitle
              title="Other templates"
              detail={`${otherTemplates.length} saved`}
            />

            {otherTemplates.map((template, index) => (
              <TemplateCard
                key={template.id}
                template={template}
                index={index}
                isNext={false}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
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
}: {
  template: MobileWorkoutTemplate
  index: number
  isNext: boolean
}) {
  return (
    <FitCard
      style={[styles.templateCard, isNext && styles.nextTemplateCard]}
      onPress={triggerLightHaptic}
    >
      <View style={styles.templateRow}>
        <View style={[styles.templateNumber, isNext && styles.nextNumber]}>
          <Text
            style={[styles.templateNumberText, isNext && styles.nextNumberText]}
          >
            {template.in_plan ? index + 1 : "•"}
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

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
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
    paddingBottom: 110,
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
    gap: spacing.sm,
  },
  startButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  startButtonText: {
    color: colors.background,
    fontSize: 16,
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
})