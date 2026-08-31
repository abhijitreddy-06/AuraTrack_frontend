import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { getSettings } from "../services/settings";
import { FloatingNav } from "../components/navigation/FloatingNav";

export const ProfileScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<{ fullname: string; email: string } | null>(null);

  useEffect(() => {
    getSettings().then((result) => setProfile(result.data.user)).catch(() => undefined);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Feather name="user" size={42} color="#FFFFFF" />
        </View>
        {profile ? (
          <>
            <Text style={[styles.name, { color: colors.textPrimary }]}>{profile.fullname}</Text>
            <View style={[styles.detailRow, { borderBottomColor: colors.divider }]}>
              <Feather name="mail" size={19} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textPrimary }]}>{profile.email}</Text>
            </View>
          </>
        ) : <ActivityIndicator color={colors.primary} />}
      </View>
      <FloatingNav activeTab="home" onTabPress={() => undefined} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", padding: spacing.lg },
  backButton: { padding: spacing.sm },
  headerSpacer: { width: 38 },
  title: { fontFamily: typography.family, fontSize: 20, fontWeight: "700" },
  content: { alignItems: "center", flex: 1, padding: spacing.xl },
  avatar: { alignItems: "center", borderRadius: 56, height: 112, justifyContent: "center", width: 112 },
  name: { fontFamily: typography.family, fontSize: 24, fontWeight: "700", marginTop: spacing.lg },
  detailRow: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", marginTop: spacing.xl, paddingBottom: spacing.md, width: "100%" },
  detailText: { fontFamily: typography.family, fontSize: 16, marginLeft: spacing.md },
});