"use client";

import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

const SIDEBAR_COOKIE_NAME = "sidebar_panel_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextValue {
	/** Whether the panel is manually open (user preference) */
	isPanelOpen: boolean;
	/** Set panel open state */
	setPanelOpen: (open: boolean) => void;
	/** Toggle panel open/closed */
	togglePanel: () => void;
	/** Computed state for data attributes */
	panelState: "expanded" | "collapsed";
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Hook to access sidebar panel state
 * Must be used within a SidebarProvider
 */
export function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider");
	}
	return context;
}

/**
 * Get initial panel state from cookie (server-safe)
 */
function getInitialPanelState(): boolean {
	if (typeof document === "undefined") {
		return true;
	}

	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split("=");
		if (name === SIDEBAR_COOKIE_NAME) {
			return value === "true";
		}
	}
	return true; // Default to open
}

interface SidebarProviderProps extends PropsWithChildren {
	/** Default panel state (defaults to true/open) */
	defaultOpen?: boolean;
	/** Controlled panel state */
	open?: boolean;
	/** Callback when panel state changes */
	onOpenChange?: (open: boolean) => void;
}

export function SidebarProvider({
	defaultOpen,
	open: openProp,
	onOpenChange,
	children,
}: SidebarProviderProps) {
	// Internal state - initialized from cookie or default
	const [_isPanelOpen, _setIsPanelOpen] = useState(
		() => defaultOpen ?? getInitialPanelState(),
	);

	// Support controlled and uncontrolled modes
	const isPanelOpen = openProp ?? _isPanelOpen;

	const setPanelOpen = useCallback(
		(open: boolean) => {
			if (onOpenChange) {
				onOpenChange(open);
			} else {
				_setIsPanelOpen(open);
			}

			// Persist to cookie
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
		},
		[onOpenChange],
	);

	const togglePanel = useCallback(() => {
		setPanelOpen(!isPanelOpen);
	}, [isPanelOpen, setPanelOpen]);

	// Keyboard shortcut: Cmd/Ctrl + B
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
				(event.metaKey || event.ctrlKey)
			) {
				event.preventDefault();
				togglePanel();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [togglePanel]);

	const panelState = isPanelOpen ? "expanded" : "collapsed";

	const value = useMemo<SidebarContextValue>(
		() => ({
			isPanelOpen,
			setPanelOpen,
			togglePanel,
			panelState,
		}),
		[isPanelOpen, setPanelOpen, togglePanel, panelState],
	);

	return (
		<SidebarContext.Provider value={value}>
			{children}
		</SidebarContext.Provider>
	);
}
