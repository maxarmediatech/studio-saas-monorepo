"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const PORTAL_TARGET_ID = "settings-header-actions";
const subscribeToPortalTarget = () => () => {};
const getServerPortalTarget = () => null;
const getPortalTarget = () => document.getElementById(PORTAL_TARGET_ID);

export function SettingsHeaderPortal({
	children,
}: {
	children: React.ReactNode;
}) {
	const target = useSyncExternalStore(
		subscribeToPortalTarget,
		getPortalTarget,
		getServerPortalTarget,
	);

	if (!target) {
		return null;
	}

	return createPortal(children, target);
}
