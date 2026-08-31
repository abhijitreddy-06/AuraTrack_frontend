import React, { useEffect, useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Animated, Easing } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface ServiceItemProps {
  name: string;
  onPress?: () => void;
}

export const ServiceItem: React.FC<ServiceItemProps> = ({ name, onPress }) => {
  const { colors } = useTheme();
  const arrowTranslate = useRef(new Animated.Value(0)).current;
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = () => {
    // Animate arrow → slide right and back
    Animated.sequence([
      Animated.timing(arrowTranslate, {
        toValue: 10,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(arrowTranslate, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => {
      Animated.timing(arrowTranslate, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }, 250);
    onPress?.();
  };

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.secondaryBackground },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
      <Animated.View style={{ transform: [{ translateX: arrowTranslate }] }}>
        <Feather name="chevron-right" size={24} color={colors.primary} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 12,
    height: 85,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: typography.family,
  },
});
