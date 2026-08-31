import React from "react";
import { Image, View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";

interface LogoProps {
  size?: number;
  showName?: boolean;
  appName?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 38,
  showName = true,
  appName = "AuraTrack",
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.row} testID="app-logo">
      <Image
        source={
          isDark
            ? require("../../../public/logo_black.png")
            : require("../../../public/logo.png")
        }
        style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}
        accessibilityLabel="AuraTrack logo"
      />
      {showName && (
        <Text
          style={[
            styles.name,
            {
              color: colors.textPrimary,
              fontFamily: typography.family,
            },
          ]}
        >
          {appName}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  mark: {
    overflow: "hidden",
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
});
