import { useSignIn } from "@clerk/clerk-expo"
import { Link, router } from "expo-router"
import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { colors, radius, spacing } from "@/constants/fitforgeTheme"

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()

  const [emailAddress, setEmailAddress] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSignInPress() {
    if (!isLoaded || submitting) return

    try {
      setSubmitting(true)
      setError(null)

      const signInAttempt = await signIn.create({
        identifier: emailAddress.trim(),
        password,
      })

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId })
        router.replace("/(tabs)")
      } else {
        setError("Additional verification is required.")
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sign in. Try again."

      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View>
          <Text style={styles.logo}>FitForge</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue your workouts.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onSignInPress}
            disabled={submitting}
            style={({ pressed }) => [
              styles.button,
              pressed && !submitting ? styles.buttonPressed : null,
              submitting ? styles.buttonDisabled : null,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>

          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={styles.secondaryLink}>
              <Text style={styles.secondaryText}>
                Don&apos;t have an account?{" "}
                <Text style={styles.linkAccent}>Create one</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  logo: {
    color: colors.teal,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    fontWeight: "700",
  },
  button: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryLink: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  linkAccent: {
    color: colors.teal,
  },
  error: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
})