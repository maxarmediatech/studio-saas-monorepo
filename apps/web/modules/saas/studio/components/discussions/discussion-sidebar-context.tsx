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

const DISCUSSION_SIDEBAR_COOKIE_NAME = "discussion_sidebar_state";
const DISCUSSION_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const DISCUSSION_SIDEBAR_KEYBOARD_SHORTCUT = "[";

interface DiscussionSidebarContextValue {
	isExpanded: boolean;
	setExpanded: (expanded: boolean) => void;
	toggleSidebar: () => void;
}

const DiscussionSidebarContext =
	createContext<DiscussionSidebarContextValue | null>(null);

export function useDiscussionSidebar() {
	const context = useContext(DiscussionSidebarContext);
	if (!context) {
		throw new Error(
			"useDiscussionSidebar must be used within a DiscussionSidebarProvider",
		);
	}
	return context;
}

export function useDiscussionSidebarSafe() {
	return useContext(DiscussionSidebarContext);
}

function getInitialSidebarState(): boolean {
	if (typeof document === "undefined") {
		return true;
	}

	const value = Cookies.get(DISCUSSION_SIDEBAR_COOKIE_NAME);
	if (!value) {
		return true;
	}

	return value === "true";
}

interface DiscussionSidebarProviderProps extends PropsWithChildren {
	defaultExpanded?: boolean;
}

export function DiscussionSidebarProvider({
	defaultExpanded,
	children,
}: DiscussionSidebarProviderProps) {
	const [isExpanded, setIsExpanded] = useState(
		() => defaultExpanded ?? getInitialSidebarState(),
	);

	const setExpanded = useCallback((expanded: boolean) => {
		setIsExpanded(expanded);

		Cookies.set(DISCUSSION_SIDEBAR_COOKIE_NAME, String(expanded), {
			expires: DISCUSSION_SIDEBAR_COOKIE_MAX_AGE / (60 * 60 * 24),
			path: "/",
		});
	}, []);

	const toggleSidebar = useCallback(() => {
		setExpanded(!isExpanded);
	}, [isExpanded, setExpanded]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === DISCUSSION_SIDEBAR_KEYBOARD_SHORTCUT &&
				(event.metaKey || event.ctrlKey)
			) {
				event.preventDefault();
				toggleSidebar();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleSidebar]);

	const value = useMemo<DiscussionSidebarContextValue>(
		() => ({
			isExpanded,
			setExpanded,
			toggleSidebar,
		}),
		[isExpanded, setExpanded, toggleSidebar],
	);

	return (
		<DiscussionSidebarContext.Provider value={value}>
			{children}
		</DiscussionSidebarContext.Provider>
	);
}
