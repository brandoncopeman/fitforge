import * as Haptics from "expo-haptics"
import { ReactNode } from "react"
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native"

import { colors, radius, shadow, spacing } from "@/constants/fitforgeTheme"

type FitCardProps = {
  children: ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  accent?: boolean
}

function triggerPressHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

export default function FitCard({
  children,
  onPress,
  style,
  accent = false,
}: FitCardProps) {
  return (
    <Pressable
      onPress={() => {
        triggerPressHaptic()
        onPress?.()
      }}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        accent && styles.accentCard,
        pressed && onPress ? styles.pressed : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  },
  accentCard: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
})