import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  LayoutChangeEvent,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../hooks/useTheme";
import { Logo } from "../components/common/Logo";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import * as authService from "../services/auth";

type AuthMode = "signin" | "signup";

interface AuthScreenProps {
  onSuccess?: () => void; // called after successful sign in/up
}

type FloatingFieldProps = {
  label: string;
  iconName: keyof typeof Feather.glyphMap;
  value: string;
  onChangeText: (text: string) => void;
  colors: ReturnType<typeof useTheme>["colors"];
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

const FloatingField: React.FC<FloatingFieldProps> = ({
  label,
  iconName,
  value,
  onChangeText,
  colors,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
}) => {
  const [focused, setFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const floatValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const shouldSecure = secureTextEntry && !isPasswordVisible;

  useEffect(() => {
    const shouldFloat = focused || value.trim().length > 0;
    Animated.timing(floatValue, {
      toValue: shouldFloat ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focused, value, floatValue]);

  const labelTranslateY = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });

  const labelScale = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.84],
  });

  return (
    <View
      style={[
        styles.inputWrapper,
        {
          borderColor:
            focused || value.length > 0 ? colors.primary : colors.divider,
          backgroundColor: colors.secondaryBackground,
        },
      ]}
    >
      <Feather
        name={iconName}
        size={20}
        color={
          focused || value.length > 0 ? colors.primary : colors.textSecondary
        }
        style={styles.inputIcon}
      />
      <View style={styles.inputBody}>
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.floatingLabel,
            {
              color:
                focused || value.length > 0
                  ? colors.primary
                  : colors.textSecondary,
              transform: [
                { translateY: labelTranslateY },
                { scale: labelScale },
              ],
            },
          ]}
        >
          {label}
        </Animated.Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={shouldSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder=" "
          placeholderTextColor="transparent"
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity
          onPress={() => setIsPasswordVisible((prev) => !prev)}
          style={styles.visibilityToggle}
        >
          <Feather
            name={isPasswordVisible ? "eye-off" : "eye"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const GoogleMark = () => (
  <Svg width={28} height={28} viewBox="0 0 18 18">
    <Path
      d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.615z"
      fill="#4285F4"
    />
    <Path
      d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      fill="#34A853"
    />
    <Path
      d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
      fill="#FBBC05"
    />
    <Path
      d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      fill="#EA4335"
    />
  </Svg>
);

const AuthLoadingOverlay = () => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animation.start();
    return () => animation.stop();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.loadingOverlay} pointerEvents="auto">
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={84} height={84} viewBox="0 0 84 84">
          <Circle
            cx="42"
            cy="42"
            r="29"
            fill="none"
            stroke="#D9E8FF"
            strokeWidth="5"
            opacity={0.45}
          />
          <Circle
            cx="42"
            cy="42"
            r="29"
            fill="none"
            stroke="#2F80ED"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="58 124"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const { colors, isDark, toggleTheme, setLocalTheme } = useTheme();

  useEffect(() => {
    setLocalTheme("light");
  }, [setLocalTheme]);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toggleWidth, setToggleWidth] = useState(0);
  const toggleProgress = useRef(new Animated.Value(0)).current;

  const switchMode = (newMode: AuthMode) => {
    if (isSubmitting) {
      return;
    }
    setMode(newMode);
  };

  useEffect(() => {
    Animated.timing(toggleProgress, {
      toValue: mode === "signin" ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mode, toggleProgress]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (!email.trim() || !password) {
        throw new Error("Please enter your email and password.");
      }

      if (mode === "signup" && !fullName.trim()) {
        throw new Error("Please enter your full name.");
      }

      if (mode === "signup") {
        await authService.signup(fullName.trim(), email.trim(), password);
      } else {
        await authService.login(email.trim(), password);
      }

      onSuccess?.();
    } catch (error) {
      Alert.alert(
        mode === "signin" ? "Sign in failed" : "Sign up failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const indicatorWidth = Math.max((toggleWidth - 8) / 2, 0);
  const indicatorTranslateX = toggleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, indicatorWidth],
  });

  const handleToggleLayout = (event: LayoutChangeEvent) => {
    setToggleWidth(event.nativeEvent.layout.width);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header: Logo + Theme Toggle */}
          <View style={styles.header}>
            <Logo size={34} showName />
            <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
              <Feather
                name={isDark ? "sun" : "moon"}
                size={22}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Segmented Control */}
          <View
            style={[
              styles.segmentedContainer,
              { backgroundColor: colors.secondaryBackground },
            ]}
            onLayout={handleToggleLayout}
          >
            {indicatorWidth > 0 && (
              <Animated.View
                style={[
                  styles.segmentedIndicator,
                  {
                    backgroundColor: colors.primary,
                    width: indicatorWidth,
                    transform: [{ translateX: indicatorTranslateX }],
                  },
                ]}
              />
            )}
            <TouchableOpacity
              style={[
                styles.segment,
                mode === "signin" && styles.activeSegment,
              ]}
              onPress={() => switchMode("signin")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: mode === "signin" ? "#ffffff" : colors.textSecondary,
                  },
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                mode === "signup" && styles.activeSegment,
              ]}
              onPress={() => switchMode("signup")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: mode === "signup" ? "#ffffff" : colors.textSecondary,
                  },
                ]}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>
              {mode === "signin" ? "Welcome back" : "Create account"}
            </Text>

            {mode === "signup" && (
              <FloatingField
                label="Full Name"
                iconName="user"
                value={fullName}
                onChangeText={setFullName}
                colors={colors}
              />
            )}

            <FloatingField
              label="Email"
              iconName="mail"
              value={email}
              onChangeText={setEmail}
              colors={colors}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FloatingField
              label="Password"
              iconName="lock"
              value={password}
              onChangeText={setPassword}
              colors={colors}
              secureTextEntry
              autoCapitalize="none"
            />

            {mode === "signin" && (
              <TouchableOpacity
                style={styles.forgotPassword}
                activeOpacity={0.6}
              >
                <Text style={[styles.forgotText, { color: colors.primary }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: colors.primary,
                  opacity: isSubmitting ? 0.9 : 1,
                },
              ]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <View style={styles.submitContent}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.submitButtonText}>
                    {mode === "signin" ? "Signing in..." : "Creating..."}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
      {isSubmitting && <AuthLoadingOverlay />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["2xl"],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  themeToggle: {
    padding: spacing.sm,
  },
  segmentedContainer: {
    flexDirection: "row",
    borderRadius: 24,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    position: "relative",
    height: 54,
    overflow: "hidden",
  },
  segmentedIndicator: {
    position: "absolute",
    height: "100%",
    borderRadius: 21,
    top: 0,
    left: 3,
  },
  segment: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 30,
    zIndex: 1,
  },
  activeSegment: {
    // no extra style needed — indicator handles background
  },
  segmentText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  form: {
    marginBottom: spacing.xl,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: typography.family,
    marginBottom: spacing.lg,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    minHeight: 60,
  },
  inputBody: {
    flex: 1,
    justifyContent: "center",
    minHeight: 60,
  },
  visibilityToggle: {
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family,
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 0,
    marginTop: 2,
  },
  floatingLabel: {
    position: "absolute",
    left: 0,
    top: 18,
    fontSize: 15,
    fontWeight: "500",
    fontFamily: typography.family,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: spacing.lg,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: "500",
  },
  submitButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  submitContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  footer: {
    marginTop: "auto",
    paddingTop: spacing.xl,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    marginHorizontal: spacing.md,
    fontFamily: typography.family,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: typography.family,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
});
