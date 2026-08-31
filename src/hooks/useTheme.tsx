import React, {
  createContext,
  ReactNode,
  useContext,
  useCallback,
  useState,
} from "react";
import { colors as themeColors } from "../theme/colors";
import { getSettings, updateThemePreference } from "../services/settings";
import type { ThemePreference } from "../services/settings";

export type Theme = "light" | "dark";

interface ThemeContextProps {
  theme: Theme;
  colors: typeof themeColors.light & typeof themeColors.dark;
  isDark: boolean;
  isReady: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemePreference) => void;
  setLocalTheme: (theme: Theme) => void;
  loadThemePreference: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{
  children: ReactNode;
  initialMode?: Theme;
}> = ({ children, initialMode }) => {
  const [theme, setThemeState] = useState<Theme>(initialMode || "light");
  const [isReady] = useState(true);

  const applyThemePreference = (nextPreference: ThemePreference) => {
    setThemeState(nextPreference);
  };

  const setTheme = (nextPreference: ThemePreference) => {
    applyThemePreference(nextPreference);
    void updateThemePreference(nextPreference).catch(() => undefined);
  };

  const setLocalTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");
  const loadThemePreference = useCallback(async () => {
    try {
      const result = await getSettings();
      applyThemePreference(result.data.user.theme_preference);
    } catch {
      // Unauthenticated screens keep the default light theme until a session is ready.
    }
  }, []);
  const colors = theme === "light" ? themeColors.light : themeColors.dark;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors,
        isDark: theme === "dark",
        isReady,
        toggleTheme,
        setTheme,
        setLocalTheme,
        loadThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
