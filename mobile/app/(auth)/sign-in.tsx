import { useSignIn } from "@clerk/clerk-expo"
import { Link, router } from "expo-router"
import { useMemo, useState } from "react"
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

type SecondFactorStrategy = "email_code" | "phone_code" | "totp"

function getReadableError(err: unknown) {
  if (
    typeof err === "object" &&
    err !== null &&
    "errors" in err &&
    Array.isArray((err as { errors?: unknown[] }).errors)
  ) {
    const firstError = (err as { errors: { longMessage?: string; message?: string }[] })
      .errors[0]

    return firstError?.longMessage || firstError?.message || "Something went wrong."
  }

  if (err instanceof Error) {
    return err.message
  }

  return "Something went wrong."
}

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()

  const [emailAddress, setEmailAddress] = useState("")
  const [password, setPassword] = useState("")
  const [secondFactorCode, setSecondFactorCode] = useState("")
  const [secondFactorStrategy, setSecondFactorStrategy] =
    useState<SecondFactorStrategy | null>(null)
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const secondFactorLabel = useMemo(() => {
    if (secondFactorStrategy === "totp") return "Authenticator code"
    if (secondFactorStrategy === "phone_code") return "SMS verification code"
    return "Email verification code"
  }, [secondFactorStrategy])

  async function completeSignIn(createdSessionId: string | null) {
    if (!createdSessionId) {
      setError("Clerk did not return a session. Please try again.")
      return
    }
  
    if (!setActive) {
      setError("Clerk is not ready yet. Please try again.")
      return
    }
  
    await setActive({ session: createdSessionId })
    router.replace("/(tabs)")
  }

  async function prepareSecondFactor() {
    if (!signIn) return

    const supportedSecondFactors = signIn.supportedSecondFactors ?? []

    const emailFactor = supportedSecondFactors.find(
      (factor) => factor.strategy === "email_code"
    )

    const phoneFactor = supportedSecondFactors.find(
      (factor) => factor.strategy === "phone_code"
    )

    const totpFactor = supportedSecondFactors.find(
      (factor) => factor.strategy === "totp"
    )

    if (emailFactor) {
      setSecondFactorStrategy("email_code")
      await signIn.prepareSecondFactor({
        strategy: "email_code",
      })
      return
    }

    if (phoneFactor) {
      setSecondFactorStrategy("phone_code")
      await signIn.prepareSecondFactor({
        strategy: "phone_code",
      })
      return
    }

    if (totpFactor) {
      setSecondFactorStrategy("totp")
      return
    }

    setError("This account needs a second verification method that this app does not support yet.")
  }

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
        await completeSignIn(signInAttempt.createdSessionId)
        return
      }

      if (signInAttempt.status === "needs_second_factor") {
        setNeedsSecondFactor(true)
        await prepareSecondFactor()
        return
      }

      if (signInAttempt.status === "needs_first_factor") {
        setError("This sign-in method needs another first factor. Try email and password.")
        return
      }

      if (signInAttempt.status === "needs_new_password") {
        setError("This account needs a new password before signing in.")
        return
      }

      setError(`Sign-in incomplete: ${signInAttempt.status}`)
    } catch (err) {
      setError(getReadableError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onVerifySecondFactorPress() {
    if (!isLoaded || submitting || !secondFactorStrategy) return

    try {
      setSubmitting(true)
      setError(null)

      const signInAttempt = await signIn.attemptSecondFactor({
        strategy: secondFactorStrategy,
        code: secondFactorCode.trim(),
      })

      if (signInAttempt.status === "complete") {
        await completeSignIn(signInAttempt.createdSessionId)
        return
      }

      setError(`Verification incomplete: ${signInAttempt.status}`)
    } catch (err) {
      setError(getReadableError(err))
    } finally {
      setSubmitting(false)
    }
  }

  function resetSecondFactor() {
    setNeedsSecondFactor(false)
    setSecondFactorCode("")
    setSecondFactorStrategy(null)
    setError(null)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View>
          <Text style={styles.logo}>FitForge</Text>
          <Text style={styles.title}>
            {needsSecondFactor ? "Verify it’s you" : "Welcome back"}
          </Text>
          <Text style={styles.subtitle}>
            {needsSecondFactor
              ? `Enter the ${secondFactorLabel.toLowerCase()} from Clerk.`
              : "Sign in to continue your workouts."}
          </Text>
        </View>

        <View style={styles.form}>
          {needsSecondFactor ? (
            <>
              <TextInput
                value={secondFactorCode}
                onChangeText={setSecondFactorCode}
                placeholder={secondFactorLabel}
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={onVerifySecondFactorPress}
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
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </Pressable>

              <Pressable onPress={resetSecondFactor} style={styles.secondaryLink}>
                <Text style={styles.secondaryText}>
                  Use a different account
                </Text>
              </Pressable>
            </>
          ) : (
            <>
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
            </>
          )}
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