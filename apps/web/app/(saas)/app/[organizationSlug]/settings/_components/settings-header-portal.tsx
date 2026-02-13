"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const PORTAL_TARGET_ID = "settings-header-actions";

export function SettingsHeaderPortal({ children }: { children: React.ReactNode }) {
	const [target, setTarget] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setTarget(document.getElementById(PORTAL_TARGET_ID));
	}, []);

	if (!target) return null;

	return createPortal(children, target);
}
