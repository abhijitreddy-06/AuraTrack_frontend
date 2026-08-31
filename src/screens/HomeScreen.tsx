import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { ServiceItem } from "../components/service/ServiceItem";
import { FloatingNav, NavTab } from "../components/navigation/FloatingNav";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { useRouter } from "expo-router";

type SectionIcon = keyof typeof Feather.glyphMap;

// Grouped services with section headers and icons
const SECTIONS = [
  {
    title: "Finance",
    icon: "trending-up" as SectionIcon,
    data: [
      "Add Expense",
      "Add Income",
      "Borrowed Money",
      "Lend Money",
      "Planned Expenses",
      "Check Balance",
      "History",
    ],
  },
  {
    title: "Productivity",
    icon: "check-square" as SectionIcon,
    data: ["Todo List", "Habits", "Notes", "Birthdays"],
  },
  {
    title: "Security & Documents",
    icon: "lock" as SectionIcon,
    data: ["Password Manager", "Documents", "Secure Notes"],
  },
] as const;

export const HomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NavTab>("home");

  const handleTabPress = (tab: NavTab) => {
    setActiveTab(tab);
  };

  const handleServicePress = (service: string) => {
    if (service === "Birthdays") {
      router.push("/birthday"); // we'll create this route
    } else if (service === "Todo List") {
      router.push("/todo");
    } else if (service === "Password Manager") {
      router.push("/password-manager");
    } else if (service === "Documents") {
      router.push("/documents");
    } else if (service === "Notes") {
      router.push("/notes");
    } else if (service === "Secure Notes") {
      router.push("/secure-notes");
    } else if (service === "Add Expense") {
      router.push("/add-expense");
    } else if (service === "Add Income") {
      router.push("/add-income");
    } else if (service === "Borrowed Money") {
      router.push("/borrowed-money");
    } else if (service === "Lend Money") {
      router.push("/lend-money");
    } else if (service === "Planned Expenses") {
      router.push("/planned-expenses");
    } else if (service === "Check Balance") {
      router.push("/check-balance");
    } else if (service === "History") {
      router.push("/history");
    }
    if (service === "Habits") {
      router.push("/habits");
    }
  };

  const renderSectionHeader = ({
    section,
  }: {
    section: { title: string; icon: SectionIcon };
  }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Feather name={section.icon} size={18} color={colors.textSecondary} />
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {section.title}
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image
            source={
              isDark
                ? require("../../public/logo_black.png")
                : require("../../public/logo.png")
            }
            style={styles.brandLogo}
            accessibilityLabel="AuraTrack logo"
          />
          <Text style={[styles.brandName, { color: colors.textPrimary }]}>
            Aura<Text style={{ color: colors.primary }}>Track</Text>
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/profile")}
            accessibilityLabel="Open profile"
          >
            <Feather name="user" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sectioned Services List */}
      <SectionList
        sections={SECTIONS}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <ServiceItem name={item} onPress={() => handleServicePress(item)} />
        )}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />

      {/* Floating Navigation */}
      <FloatingNav activeTab={activeTab} onTabPress={handleTabPress} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  brandLogo: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  brandName: {
    fontFamily: typography.family,
    fontSize: 20,
    fontWeight: "700",
  },
  iconButton: {
    padding: spacing.sm,
  },
  listContent: {
    paddingVertical: spacing.md,
    paddingBottom: spacing["2xl"],
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: typography.family,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginTop: spacing.xs,
    opacity: 0.3,
  },
});
