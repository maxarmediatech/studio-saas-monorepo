import { useEffect, useState } from "react";
import type { ThemeMode } from "../app/types";

const themeStorageKey = "experimental-desktop-theme";

function resolveInitialTheme(): ThemeMode {
	const stored = window.localStorage.getItem(themeStorageKey);
	if (stored === "dark" || stored === "light") {
		return stored;
	}
	return window.matchMedia("(prefers-color-scheme: light)").matches
		? "light"
		: "dark";
}

export function useThemeMode() {
	const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme());

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		document.documentElement.dataset.theme = theme;
		window.localStorage.setItem(themeStorageKey, theme);
	}, [theme]);

	return {
		theme,
		toggleTheme: () =>
			setTheme((current) => (current === "dark" ? "light" : "dark")),
	};
}
