import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { useRouter } from "expo-router";

export type NavTab = "home" | "aura" | "analytics" | "settings";

interface FloatingNavProps {
  activeTab: NavTab;
  onTabPress: (tab: NavTab) => void;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({
  activeTab,
  onTabPress,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  const tabs: {
    key: NavTab;
    label: string;
  }[] = [
    { key: "home", label: "Home" },
    { key: "aura", label: "Aura" },
    { key: "analytics", label: "Analytics" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.secondaryBackground },
      ]}
    >
      {tabs.map(({ key, label }) => {
        const isActive = activeTab === key;
        const color = isActive ? colors.primary : colors.textSecondary;

        return (
          <TouchableOpacity
            key={key}
            style={styles.tab}
            onPress={() => {
              onTabPress(key);
              if (key === "aura") {
                router.replace("/aura");
              } else if (key === "analytics") {
                router.replace("/analytics");
              } else if (key === "settings") {
                router.replace("/settings");
              } else if (key === "home") {
                router.replace("/home");
              }
            }}
            activeOpacity={0.6}
          >
            {key === "aura" ? (
              <Text style={[styles.auraIcon, { color }]}>✦</Text>
            ) : (
              <Feather
                name={
                  key === "home"
                    ? "home"
                    : key === "analytics"
                      ? "bar-chart-2"
                      : "settings"
                }
                size={24}
                color={color}
              />
            )}
            <Text
              style={[
                styles.label,
                { color, fontFamily: typography.family },
                isActive && styles.activeLabel,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    height: 72, // fixed height to accommodate icon + label
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  activeLabel: {
    fontWeight: "600",
  },
  auraIcon: {
    fontFamily: typography.family,
    fontSize: 26,
    fontWeight: "700",
    height: 27,
    lineHeight: 27,
  },
});
