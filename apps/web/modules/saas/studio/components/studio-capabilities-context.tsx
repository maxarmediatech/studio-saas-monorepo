"use client";

import { createContext, type PropsWithChildren, useContext } from "react";
import type { HeaderCapabilities } from "../lib/capability.server";

const EMPTY_CAPABILITIES: HeaderCapabilities = {
	bookingCreateOrUpdate: false,
	quoteCreate: false,
	quoteReadOperational: false,
	quoteUpdate: false,
	quoteSend: false,
	quoteRevise: false,
	quoteAccept: false,
	quoteDecline: false,
	quoteExpire: false,
	quoteConvert: false,
	shootCreateOrUpdate: false,
	deliverableCreateOrUpdate: false,
	deliverableUpdate: false,
	deliverableList: false,
	taskCreateOrUpdate: false,
	taskCreate: false,
	taskRead: false,
	taskListOrReference: false,
	bookingReadOrList: false,
	bookingReadOrReference: false,
	shootReadOrList: false,
	deliverableReadOrList: false,
	taskReadOrList: false,
	expenseCreateOrUpdate: false,
	paymentCreateOrUpdate: false,
	expenseReadOrReference: false,
	paymentReadOrReference: false,
	crewCreateOrUpdate: false,
	clientCreateOrUpdate: false,
	clientList: false,
	configurationCreateOrUpdate: false,
	activityRead: false,
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
