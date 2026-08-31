import React from "react";
import { Image, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export const AboutScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>About</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.content}>
        <Image
          source={
            isDark
              ? require("../../public/logo_black.png")
              : require("../../public/logo.png")
          }
          style={styles.logo}
          accessibilityLabel="AuraTrack logo"
        />
        <Text style={[styles.appName, { color: colors.textPrimary }]}>AuraTrack</Text>
        <Text style={[styles.version, { color: colors.textSecondary }]}>Version 1.0.0</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>A calm place to keep track of your finances, habits, and everyday plans.</Text>
        <View style={[styles.group, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.row}><Feather name="shield" size={19} color={colors.textSecondary} /><Text style={[styles.rowText, { color: colors.textPrimary }]}>Privacy and security</Text></View>
          <View style={styles.row}><Feather name="help-circle" size={19} color={colors.textSecondary} /><Text style={[styles.rowText, { color: colors.textPrimary }]}>Help and support</Text></View>
          <View style={styles.row}><Feather name="file-text" size={19} color={colors.textSecondary} /><Text style={[styles.rowText, { color: colors.textPrimary }]}>Terms of service</Text></View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", padding: spacing.lg },
  backButton: { padding: spacing.sm },
  headerSpacer: { width: 38 },
  title: { fontFamily: typography.family, fontSize: 20, fontWeight: "700" },
  content: { alignItems: "center", padding: spacing.xl },
  logo: { borderRadius: 48, height: 96, width: 96 },
  appName: { fontFamily: typography.family, fontSize: 26, fontWeight: "700", marginTop: spacing.md },
  version: { fontFamily: typography.family, fontSize: 13, marginTop: spacing.xs },
  description: { fontFamily: typography.family, fontSize: 15, lineHeight: 22, marginTop: spacing.xl, textAlign: "center" },
  group: { borderRadius: 12, marginTop: spacing.xl, overflow: "hidden", width: "100%" },
  row: { alignItems: "center", flexDirection: "row", minHeight: 56, paddingHorizontal: spacing.md },
  rowText: { fontFamily: typography.family, fontSize: 15, marginLeft: spacing.md },
});
