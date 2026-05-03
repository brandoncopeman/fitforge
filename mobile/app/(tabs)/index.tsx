import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import StatTile from "@/components/StatTile"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"

const mockHome = {
  displayName: "Brandon",
  quote: {
    text: "The pain you feel today will be the strength you feel tomorrow.",
    author: "Arnold Schwarzenegger",
  },
  caloriesConsumed: 0,
  calorieTarget: 2609,
  steps: 0,
  stepTarget: 8000,
  latestWeight: 115,
  nextWorkout: "Push",
  nextExercises: 3,
  planStatus: "Plan complete this week",
  planDetail: "40/3 workouts complete",
  streakWeeks: 2,
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>FitForge</Text>
            <Text style={styles.subTitle}>Native preview</Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>B</Text>
          </View>
        </View>

        <FitCard>
          <Text style={styles.welcome}>
            Welcome back, {mockHome.displayName}
          </Text>
          <Text style={styles.quote}>“{mockHome.quote.text}”</Text>
          <Text style={styles.quoteAuthor}>— {mockHome.quote.author}</Text>
        </FitCard>

        <FitCard accent onPress={() => router.push("/workouts")}>
          <View style={styles.nextHeader}>
            <View>
              <Text style={styles.eyebrow}>Next in plan</Text>
              <Text style={styles.nextTitle}>{mockHome.nextWorkout}</Text>
              <Text style={styles.nextDetail}>
                {mockHome.nextExercises} exercises
              </Text>
            </View>

            <View style={styles.startCircle}>
              <Ionicons name="play" size={24} color={colors.background} />
            </View>
          </View>
        </FitCard>

        <View style={styles.tileRow}>
          <StatTile
            label="Calories"
            value={mockHome.caloriesConsumed}
            detail={`of ${mockHome.calorieTarget} kcal`}
            accent
          />
          <StatTile
            label="Steps"
            value={mockHome.steps.toLocaleString()}
            detail={`of ${mockHome.stepTarget.toLocaleString()}`}
          />
        </View>

        <View style={styles.tileRow}>
          <StatTile
            label="Weight"
            value={`${mockHome.latestWeight}kg`}
            detail="latest log"
          />
          <StatTile
            label="Streak"
            value={`${mockHome.streakWeeks}w`}
            detail="workout streak"
            accent
          />
        </View>

        <FitCard onPress={() => router.push("/workouts")}>
          <View style={styles.rowBetween}>
            <View style={styles.rowIconText}>
              <View style={styles.iconBadge}>
                <Ionicons name="checkmark" size={20} color={colors.teal} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{mockHome.planStatus}</Text>
                <Text style={styles.cardDetail}>{mockHome.planDetail}</Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </FitCard>

        <View style={styles.quickGrid}>
          <FitCard style={styles.quickCard} onPress={() => router.push("/workouts")}>
            <Text style={styles.quickEmoji}>🏋️</Text>
            <Text style={styles.quickTitle}>Workouts</Text>
            <Text style={styles.quickDetail}>Templates & history</Text>
          </FitCard>

          <FitCard style={styles.quickCard} onPress={() => router.push("/stats")}>
            <Text style={styles.quickEmoji}>📈</Text>
            <Text style={styles.quickTitle}>Stats</Text>
            <Text style={styles.quickDetail}>Progress & badges</Text>
          </FitCard>

          <FitCard style={styles.quickCard}>
            <Text style={styles.quickEmoji}>🥗</Text>
            <Text style={styles.quickTitle}>Food</Text>
            <Text style={styles.quickDetail}>Coming soon</Text>
          </FitCard>

          <FitCard style={styles.quickCard}>
            <Text style={styles.quickEmoji}>🎯</Text>
            <Text style={styles.quickTitle}>Goals</Text>
            <Text style={styles.quickDetail}>Coming soon</Text>
          </FitCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
    gap: spacing.md,
  },
  header: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  avatar: {
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: colors.tealDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
  welcome: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  quote: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: "italic",
  },
  quoteAuthor: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  nextHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  nextTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    textTransform: "capitalize",
    marginTop: 4,
  },
  nextDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  startCircle: {
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  tileRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowIconText: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  cardDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  quickCard: {
    width: "47.9%",
    minHeight: 132,
  },
  quickEmoji: {
    fontSize: 25,
    marginBottom: spacing.sm,
  },
  quickTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  quickDetail: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 17,
  },
})