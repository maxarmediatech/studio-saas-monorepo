"use client";

import { createContext, useContext, type PropsWithChildren } from "react";
import type { HeaderCapabilities } from "../lib/capability.server";

const EMPTY_CAPABILITIES: HeaderCapabilities = {
	bookingCreateOrUpdate: false,
	shootCreateOrUpdate: false,
	deliverableCreateOrUpdate: false,
	taskCreateOrUpdate: false,
	expenseCreateOrUpdate: false,
	paymentCreateOrUpdate: false,
	crewCreateOrUpdate: false,
	clientCreateOrUpdate: false,
	configurationCreateOrUpdate: false,
};

const StudioCapabilitiesContext =
	createContext<HeaderCapabilities>(EMPTY_CAPABILITIES);

interface StudioCapabilitiesProviderProps extends PropsWithChildren {
	caps: HeaderCapabilities;
}

export function StudioCapabilitiesProvider({
	caps,
	children,
}: StudioCapabilitiesProviderProps) {
	return (
		<StudioCapabilitiesContext.Provider value={caps}>
			{children}
		</StudioCapabilitiesContext.Provider>
	);
}

export function useStudioCapabilities() {
	return useContext(StudioCapabilitiesContext);
}
