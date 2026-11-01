import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapHeader } from "@/components/MapHeader";
import { colors, radius } from "@/constants/theme";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Mode = "signup" | "login";

// Turns a failed request into text for this screen. The generic ApiError
// messages don't fit here (e.g. 401 on /login means a wrong password, not an
// expired session).
function errorMessage(e: unknown, mode: Mode): string {
  if (!(e instanceof ApiError)) return "Something went wrong.";
  if (e.status === 401) return "Wrong email or password.";
  if (e.status === 409 && mode === "signup") {
    return "An account with this email already exists. Try logging in.";
  }
  return e.message;
}

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);


  async function handleSubmit() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") await signUp(email, password);
      else await signIn(email, password);
    } catch (e) {
      setError(errorMessage(e, mode));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingLeft: insets.left, paddingRight: insets.right },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <MapHeader topInset={insets.top} />

        <View style={[styles.sheet, { paddingBottom: 40 + insets.bottom }]}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <View style={[styles.ring, { borderColor: colors.primary }]} />
              <View style={[styles.ring, styles.ringOverlap]} />
            </View>
            <Text style={styles.brandText}>Let&apos;s Connect</Text>
          </View>

          <Text style={styles.title}>See who&apos;s nearby.{"\n"}Say hi.</Text>
          <Text style={styles.subtitle}>
            Meet people around you, one request at a time.
          </Text>

          <View style={styles.segment}>
            {(["signup", "login"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
                style={[styles.segmentItem, mode === m && styles.segmentActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === m && styles.segmentTextActive,
                  ]}
                >
                  {m === "signup" ? "Sign up" : "Log in"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            textContentType={mode === "signup" ? "newPassword" : "password"}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || submitting) && styles.pressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === "signup" ? "Create account" : "Log in"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              // TODO: Google sign-in
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          </Pressable>

          <Text style={styles.legal}>
            18+ only. By continuing you agree to the{" "}
            <Text style={styles.link}>Terms</Text> and{" "}
            <Text style={styles.link}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
  },
  sheet: {
    flex: 1,
    marginTop: -28,
    paddingHorizontal: 24,
    paddingTop: 28,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logo: {
    flexDirection: "row",
  },
  ring: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3.5,
    borderColor: colors.text,
  },
  ringOverlap: {
    marginLeft: -9,
  },
  brandText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: colors.textMuted,
  },
  segment: {
    flexDirection: "row",
    marginTop: 24,
    marginBottom: 12,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.segmentBg,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.text,
  },
  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
  },
  error: {
    marginTop: 10,
    color: colors.primary,
    fontSize: 14,
  },
  primaryButton: {
    height: 56,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  secondaryButton: {
    height: 56,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  pressed: {
    opacity: 0.8,
  },
  legal: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  link: {
    textDecorationLine: "underline",
  },
});
