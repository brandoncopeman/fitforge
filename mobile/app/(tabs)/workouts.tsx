import { Ionicons } from "@expo/vector-icons"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"

import FitCard from "@/components/FitCard"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"

const templates = [
  { id: "1", name: "Push", exercises: 3, next: true },
  { id: "2", name: "Pull", exercises: 7, next: false },
  { id: "3", name: "Legs", exercises: 5, next: false },
  { id: "4", name: "Full Body", exercises: 8, next: false },
]

function haptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}

export default function WorkoutsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Workout</Text>
        <Text style={styles.subtitle}>Fast native workout flow preview</Text>

        <FitCard accent>
          <Text style={styles.eyebrow}>Ready next</Text>
          <Text style={styles.heroTitle}>Push</Text>
          <Text style={styles.heroDetail}>3 exercises in this template</Text>

          <Pressable
            onPress={haptic}
            style={({ pressed }) => [
              styles.startButton,
              pressed && styles.startButtonPressed,
            ]}
          >
            <Ionicons name="play" size={20} color={colors.background} />
            <Text style={styles.startButtonText}>Start Workout</Text>
          </Pressable>
        </FitCard>

        <Text style={styles.sectionTitle}>Plan templates</Text>

        {templates.map((template) => (
          <FitCard key={template.id} style={styles.templateCard}>
            <View style={styles.templateRow}>
              <View style={styles.templateNumber}>
                <Text style={styles.templateNumberText}>{template.id}</Text>
              </View>

              <View style={styles.templateBody}>
                <View style={styles.templateTitleRow}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  {template.next ? (
                    <View style={styles.nextPill}>
                      <Text style={styles.nextPillText}>Next</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.templateDetail}>
                  {template.exercises} exercises
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </FitCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
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
    marginBottom: spacing.sm,
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
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  templateCard: {
    padding: spacing.md,
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
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  templateNumberText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: "900",
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
})