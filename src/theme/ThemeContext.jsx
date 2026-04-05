import { createContext, useState, useEffect } from "react";
import { lightTheme, darkTheme } from "./tokens.js";

export const ThemeContext = createContext({
  theme: lightTheme,
  darkMode: false,
  setDarkMode: () => {},
});

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ostinote_darkMode")) === true; } catch { return false; }
  });
  const theme = darkMode ? darkTheme : lightTheme;

  useEffect(() => {
    localStorage.setItem("ostinote_darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ theme, darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
