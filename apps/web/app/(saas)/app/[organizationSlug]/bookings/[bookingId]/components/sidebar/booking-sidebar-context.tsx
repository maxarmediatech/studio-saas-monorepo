"use client";

import Cookies from "js-cookie";
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

const BOOKING_SIDEBAR_COOKIE_NAME = "booking_sidebar_state";
const BOOKING_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const BOOKING_SIDEBAR_KEYBOARD_SHORTCUT = "]";

interface BookingSidebarContextValue {
	/** Whether the sidebar is expanded (visible) */
	isExpanded: boolean;
	/** Set sidebar expanded state */
	setExpanded: (expanded: boolean) => void;
	/** Toggle sidebar expanded/collapsed */
	toggleSidebar: () => void;
}

const BookingSidebarContext = createContext<BookingSidebarContextValue | null>(
	null,
);

/**
 * Hook to access booking sidebar state
 * Throws if used outside BookingSidebarProvider
 */
export function useBookingSidebar() {
	const context = useContext(BookingSidebarContext);
	if (!context) {
		throw new Error(
			"useBookingSidebar must be used within a BookingSidebarProvider",
		);
	}
	return context;
}

/**
 * Safe hook to access booking sidebar state
 * Returns null if used outside BookingSidebarProvider (useful for page components)
 */
export function useBookingSidebarSafe() {
	return useContext(BookingSidebarContext);
}

/**
 * Get initial sidebar state from cookie (server-safe)
 */
function getInitialSidebarState(): boolean {
	if (typeof document === "undefined") {
		return false; // Default to collapsed for SSR
	}

	const value = Cookies.get(BOOKING_SIDEBAR_COOKIE_NAME);
	if (!value) {
		return false; // Default to collapsed
	}

	return value === "true";
}

interface BookingSidebarProviderProps extends PropsWithChildren {
	/** Default sidebar state (defaults to false/collapsed) */
	defaultExpanded?: boolean;
}

export function BookingSidebarProvider({
	defaultExpanded,
	children,
}: BookingSidebarProviderProps) {
	// Internal state - initialized from cookie or default
	const [isExpanded, setIsExpanded] = useState(
		() => defaultExpanded ?? getInitialSidebarState(),
	);

	const setExpanded = useCallback((expanded: boolean) => {
		setIsExpanded(expanded);

		// Persist to cookie
		Cookies.set(BOOKING_SIDEBAR_COOKIE_NAME, String(expanded), {
			expires: BOOKING_SIDEBAR_COOKIE_MAX_AGE / (60 * 60 * 24),
			path: "/",
		});
	}, []);

	const toggleSidebar = useCallback(() => {
		setExpanded(!isExpanded);
	}, [isExpanded, setExpanded]);

	// Keyboard shortcut: Cmd/Ctrl + ]
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === BOOKING_SIDEBAR_KEYBOARD_SHORTCUT &&
				(event.metaKey || event.ctrlKey)
			) {
				event.preventDefault();
				toggleSidebar();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleSidebar]);

	const value = useMemo<BookingSidebarContextValue>(
		() => ({
			isExpanded,
			setExpanded,
			toggleSidebar,
		}),
		[isExpanded, setExpanded, toggleSidebar],
	);

	return (
		<BookingSidebarContext.Provider value={value}>
			{children}
		</BookingSidebarContext.Provider>
	);
}
