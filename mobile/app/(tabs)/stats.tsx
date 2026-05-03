import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import StatTile from "@/components/StatTile"
import { colors, spacing } from "@/constants/fitforgeTheme"

export default function StatsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Progress, badges, and performance</Text>

        <View style={styles.tileRow}>
          <StatTile label="Workouts" value={40} detail="this week" accent />
          <StatTile label="Streak" value="2w" detail="active" />
        </View>

        <View style={styles.tileRow}>
          <StatTile label="Weight" value="115kg" detail="latest" />
          <StatTile label="Badges" value={8} detail="collected" accent />
        </View>

        <FitCard>
          <Text style={styles.cardTitle}>Weekly Recap</Text>
          <Text style={styles.cardText}>
            Your recap and badges will live here once the native app connects to
            the FitForge API.
          </Text>
        </FitCard>

        <FitCard accent>
          <Text style={styles.cardTitle}>Smooth-first rule</Text>
          <Text style={styles.cardText}>
            Charts come after the workout flow is fast. Native responsiveness
            matters more than visual complexity for v1.
          </Text>
        </FitCard>
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
  tileRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  cardText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
})