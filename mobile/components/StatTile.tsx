import { StyleSheet, Text, View } from "react-native"

import { colors, radius, spacing } from "@/constants/fitforgeTheme"

type StatTileProps = {
  label: string
  value: string | number
  detail?: string
  accent?: boolean
}

export default function StatTile({
  label,
  value,
  detail,
  accent = false,
}: StatTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent && styles.accentValue]}>{value}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 110,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    justifyContent: "space-between",
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  value: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  accentValue: {
    color: colors.teal,
  },
  detail: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: "600",
  },
})