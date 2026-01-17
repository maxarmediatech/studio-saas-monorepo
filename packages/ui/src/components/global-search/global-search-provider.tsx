"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

interface GlobalSearchContextValue {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(
	null,
);

interface GlobalSearchProviderProps {
	children: ReactNode;
}

export function GlobalSearchProvider({ children }: GlobalSearchProviderProps) {
	const [isOpen, setIsOpen] = useState(false);

	const open = useCallback(() => setIsOpen(true), []);
	const close = useCallback(() => setIsOpen(false), []);
	const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

	// Global keyboard shortcut: Cmd+K / Ctrl+K
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === "k" &&
				(event.metaKey || event.ctrlKey) &&
				!event.shiftKey
			) {
				event.preventDefault();
				toggle();
			}

			// Escape to close
			if (event.key === "Escape" && isOpen) {
				event.preventDefault();
				close();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, toggle, close]);

	return (
		<GlobalSearchContext.Provider value={{ isOpen, open, close, toggle }}>
			{children}
		</GlobalSearchContext.Provider>
	);
}

export function useGlobalSearchContext() {
	const context = useContext(GlobalSearchContext);
	if (!context) {
		throw new Error(
			"useGlobalSearchContext must be used within GlobalSearchProvider",
		);
	}
	return context;
}
