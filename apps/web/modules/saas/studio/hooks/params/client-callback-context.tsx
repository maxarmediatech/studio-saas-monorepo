"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
} from "react";

type ClientCreatedCallback = (clientId: string) => void;

interface ClientCallbackContextValue {
	registerCallback: (callback: ClientCreatedCallback) => void;
	executeCallback: (clientId: string) => void;
	clearCallback: () => void;
}

const ClientCallbackContext = createContext<ClientCallbackContextValue | null>(
	null,
);

export function ClientCallbackProvider({ children }: { children: ReactNode }) {
	const callbackRef = useRef<ClientCreatedCallback | null>(null);

	const registerCallback = useCallback((callback: ClientCreatedCallback) => {
		callbackRef.current = callback;
	}, []);

	const executeCallback = useCallback((clientId: string) => {
		if (callbackRef.current) {
			callbackRef.current(clientId);
			callbackRef.current = null;
		}
	}, []);

	const clearCallback = useCallback(() => {
		callbackRef.current = null;
	}, []);

	return (
		<ClientCallbackContext.Provider
			value={{ registerCallback, executeCallback, clearCallback }}
		>
			{children}
		</ClientCallbackContext.Provider>
	);
}

export function useClientCallback() {
	const context = useContext(ClientCallbackContext);
	if (!context) {
		throw new Error(
			"useClientCallback must be used within a ClientCallbackProvider",
		);
	}
	return context;
}
