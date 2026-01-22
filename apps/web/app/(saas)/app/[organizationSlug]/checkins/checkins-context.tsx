"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

interface CheckinsContextValue {
	isCreateDialogOpen: boolean;
	openCreateDialog: () => void;
	closeCreateDialog: () => void;
}

const CheckinsContext = createContext<CheckinsContextValue | null>(null);

export function CheckinsProvider({ children }: { children: ReactNode }) {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	const openCreateDialog = useCallback(() => setIsCreateDialogOpen(true), []);
	const closeCreateDialog = useCallback(
		() => setIsCreateDialogOpen(false),
		[],
	);

	return (
		<CheckinsContext.Provider
			value={{ isCreateDialogOpen, openCreateDialog, closeCreateDialog }}
		>
			{children}
		</CheckinsContext.Provider>
	);
}

export function useCheckinsContext() {
	const context = useContext(CheckinsContext);
	if (!context) {
		throw new Error(
			"useCheckinsContext must be used within CheckinsProvider",
		);
	}
	return context;
}
