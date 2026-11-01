import { ArrowLeft, MapPin } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Chip } from "@/components/Chip";
import { Screen } from "@/components/Screen";
import { MIN_INTERESTS, PRESET_TAGS } from "@/constants/tags";
import { colors, radius } from "@/constants/theme";
import { useSettings } from "@/lib/settings";

const STEPS = ["name", "interests", "location"] as const;
type Step = (typeof STEPS)[number];

// First-login setup. Answers are kept in local state and only saved on the
// last step: saving sets `onboarded`, which makes the root layout swap this
// screen for the tabs.
export default function OnboardingScreen() {
  const settings = useSettings();
  const { location } = settings;

  const [stepIndex, setStepIndex] = useState(0);
  const [username, setUsername] = useState(settings.profile.username);
  const [interests, setInterests] = useState<string[]>(settings.profile.interests);

  const step: Step = STEPS[stepIndex];
  const trimmedName = username.trim();

  const canContinue =
    step === "name"
      ? trimmedName.length >= 2
      : step === "interests"
        ? interests.length >= MIN_INTERESTS
        : true;

  function finish() {
    settings.completeOnboarding({ username: trimmedName, interests });
  }

  function next() {
    if (!canContinue) return;
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else finish();
  }

  function toggleInterest(tag: string) {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function allowLocation() {
    const granted = await settings.requestLocation();
    if (granted) finish();
  }

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ---------- Top: back + progress ---------- */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setStepIndex(stepIndex - 1)}
            disabled={stepIndex === 0}
            style={[styles.backButton, stepIndex === 0 && styles.hidden]}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>

          <View style={styles.progress}>
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[styles.progressBar, i <= stepIndex && styles.progressBarDone]}
              />
            ))}
          </View>

          {/* Keeps the progress bar centred. */}
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.stepCount}>
            Step {stepIndex + 1} of {STEPS.length}
          </Text>

          {/* ---------- Step 1: name ---------- */}
          {step === "name" && (
            <>
              <Text style={styles.title}>What should people call you?</Text>
              <Text style={styles.subtitle}>
                This is the name people nearby will see.
              </Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. Amara"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                maxLength={30}
                returnKeyType="next"
                onSubmitEditing={next}
                autoFocus
              />
            </>
          )}

          {/* ---------- Step 2: interests ---------- */}
          {step === "interests" && (
            <>
              <Text style={styles.title}>What are you into?</Text>
              <Text style={styles.subtitle}>
                Pick at least {MIN_INTERESTS}. We use these to show what you
                have in common with people.
              </Text>
              <View style={styles.chips}>
                {PRESET_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    selected={interests.includes(tag)}
                    onPress={() => toggleInterest(tag)}
                  />
                ))}
              </View>
              <Text style={styles.counter}>
                {interests.length} selected
                {interests.length < MIN_INTERESTS &&
                  ` · ${MIN_INTERESTS - interests.length} more to go`}
              </Text>
            </>
          )}

          {/* ---------- Step 3: location ---------- */}
          {step === "location" && (
            <>
              <View style={styles.locationIcon}>
                <MapPin size={36} color={colors.primary} />
              </View>
              <Text style={styles.title}>See who&apos;s around you</Text>
              <Text style={styles.subtitle}>
                Let&apos;s Connect uses your location to show people nearby.
                You&apos;re only visible when you choose to go live, and by
                default we show an approximate spot, never an exact pin.
              </Text>
              {location.status === "denied" && !location.canAskAgain && (
                <Text style={styles.note}>
                  Location is turned off for this app. You can turn it on in
                  your phone&apos;s Settings.
                </Text>
              )}
            </>
          )}
        </ScrollView>

        {/* ---------- Bottom buttons ---------- */}
        <View style={styles.footer}>
          {step === "location" && location.status !== "granted" ? (
            <>
              {location.canAskAgain ? (
                <PrimaryButton label="Allow location" onPress={allowLocation} />
              ) : (
                <PrimaryButton
                  label="Open Settings"
                  onPress={() => void Linking.openSettings()}
                />
              )}
              <Pressable onPress={finish} style={styles.skipButton} hitSlop={8}>
                <Text style={styles.skipText}>Not now</Text>
              </Pressable>
            </>
          ) : (
            <PrimaryButton
              label={step === "location" ? "Get started" : "Continue"}
              onPress={next}
              disabled={!canContinue}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.segmentBg,
  },
  hidden: {
    opacity: 0,
  },
  progress: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.segmentBg,
  },
  progressBarDone: {
    backgroundColor: colors.primary,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  stepCount: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
  },
  input: {
    height: 56,
    paddingHorizontal: 16,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  counter: {
    marginTop: 18,
    fontSize: 14,
    color: colors.textMuted,
  },
  locationIcon: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
  },
  note: {
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    borderRadius: radius.input,
    backgroundColor: colors.segmentBg,
    overflow: "hidden",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  primaryButton: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.8,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
