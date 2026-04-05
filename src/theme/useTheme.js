import { useContext } from "react";
import { ThemeContext } from "./ThemeContext.jsx";

export default function useTheme() {
  const { theme, darkMode, setDarkMode } = useContext(ThemeContext);
  return { T: theme, darkMode, setDarkMode };
}
