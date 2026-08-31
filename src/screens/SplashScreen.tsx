import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing } from "../theme/spacing";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.createAnimatedComponent(View);

// Rising stock line path â€“ jagged upward trend
const PATH =
  "M0,120 L40,105 L75,115 L115,80 L155,90 L195,55 L235,65 L275,30 L315,10";
const PATH_LENGTH = 420; // approximate arc length

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const splashColors = colors.light;
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - spacing.xl * 2, 320);
  const chartHeight = 140;

  const progress = useRef(new Animated.Value(1)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(180),
      Animated.timing(progress, {
        toValue: 0,
        duration: 1600,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }),
    ]).start();

    Animated.timing(brandOpacity, {
      toValue: 1,
      duration: 600,
      delay: 900,
      useNativeDriver: true,
    }).start();

    Animated.timing(footerOpacity, {
      toValue: 1,
      duration: 400,
      delay: 1400,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(onFinish, 2000);
    return () => clearTimeout(timer);
  }, [onFinish, progress, brandOpacity, footerOpacity]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PATH_LENGTH],
  });

  const dotOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: splashColors.background }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={splashColors.background}
      />

      <View style={styles.center}>
        {/* Stock line chart */}
        <View style={{ width: chartWidth, height: chartHeight }}>
          <Svg
            width={chartWidth}
            height={chartHeight}
            viewBox="0 0 315 120"
            preserveAspectRatio="xMidYMid meet"
          >
            <Defs>
              <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop
                  offset="0"
                  stopColor={splashColors.primary}
                  stopOpacity="0.35"
                />
                <Stop offset="1" stopColor={splashColors.primary} stopOpacity="1" />
              </LinearGradient>
            </Defs>

            {/* Baseline (subtle) */}
            <Path
              d="M0,120 L315,120"
              stroke={splashColors.divider}
              strokeWidth={1}
              strokeDasharray="3,5"
              opacity={0.6}
            />

            {/* Animated rising line */}
            <AnimatedPath
              d={PATH}
              stroke="url(#lineGrad)"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${PATH_LENGTH}, ${PATH_LENGTH}`}
              strokeDashoffset={strokeDashoffset}
            />

            {/* Head marker */}
            <AnimatedCircle
              cx={315}
              cy={10}
              r={6}
              fill={splashColors.primary}
              opacity={dotOpacity}
            />
          </Svg>
        </View>

        {/* App name & tagline â€“ using our Logo component? 
            We'll keep it simple with the given style */}
        <AnimatedView style={[styles.brandBlock, { opacity: brandOpacity }]}>
          <Text
            style={[
              styles.appName,
              { color: splashColors.textPrimary, fontFamily: typography.family },
            ]}
            testID="splash-app-name"
          >
            Aura<Text style={{ color: splashColors.primary }}>Track</Text>
          </Text>
          <Text
            style={[
              styles.tagline,
              { color: splashColors.textSecondary, fontFamily: typography.family },
            ]}
          >
            Your money, on the rise.
          </Text>
        </AnimatedView>
      </View>

      <AnimatedView style={[styles.footer, { opacity: footerOpacity }]}>
        <View style={[styles.dot, { backgroundColor: splashColors.primary }]} />
        <View
          style={[
            styles.dot,
            { backgroundColor: splashColors.primary, opacity: 0.6 },
          ]}
        />
        <View
          style={[
            styles.dot,
            { backgroundColor: splashColors.primary, opacity: 0.3 },
          ]}
        />
      </AnimatedView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing["2xl"],
  },
  brandBlock: {
    alignItems: "center",
    gap: spacing.sm,
  },
  appName: {
    fontSize: 36,
    fontWeight: "600",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: spacing["2xl"],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
