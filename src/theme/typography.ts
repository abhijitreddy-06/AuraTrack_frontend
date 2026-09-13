import { Platform } from "react-native";

export const typography = {
  family: Platform.select({
    ios: "System",
    android: undefined,
    default: undefined,
  }),
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
};
