export interface QuickstartState {
	hide: boolean;
	version: 2;
}

export type QuickstartUserRole = string | null;

export const DEFAULT_QUICKSTART_STATE: QuickstartState = {
	hide: false,
	version: 2,
};

export function normalizeQuickstartState(value: unknown): QuickstartState {
	if (!value || typeof value !== "object") {
		return DEFAULT_QUICKSTART_STATE;
	}

	const hide =
		"hide" in value &&
		typeof (value as { hide?: unknown }).hide === "boolean"
			? (value as { hide: boolean }).hide
			: false;

	return {
		hide,
		version: 2,
	};
}

export function isCanonicalQuickstartState(
	value: unknown,
): value is QuickstartState {
	if (!value || typeof value !== "object") {
		return false;
	}

	const record = value as Record<string, unknown>;
	const keys = Object.keys(record);

	return (
		keys.length === 2 &&
		keys.includes("hide") &&
		keys.includes("version") &&
		typeof record.hide === "boolean" &&
		record.version === 2
	);
}

export function shouldShowQuickstartGuide({
	activeOrganizationLoaded,
	activeOrganizationUserRole,
	state,
}: {
	activeOrganizationLoaded: boolean;
	activeOrganizationUserRole: QuickstartUserRole;
	state: QuickstartState;
}) {
	return (
		activeOrganizationLoaded &&
		activeOrganizationUserRole === "owner" &&
		!state.hide
	);
}
