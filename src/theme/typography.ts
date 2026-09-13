import { Platform } from "react-native";

export const typography = {
  family: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "sans-serif",
  }),
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
};