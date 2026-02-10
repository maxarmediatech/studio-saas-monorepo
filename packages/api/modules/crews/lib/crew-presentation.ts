import { normalizeRoles } from "@repo/auth/lib/permissions";

export function extractSpecializations(
	metadata: Record<string, unknown> | null | undefined,
): string[] {
	const raw = metadata?.specializations;
	if (!Array.isArray(raw)) {
		return [];
	}

	const normalized = raw
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);

	return Array.from(new Set(normalized));
}

export function applySpecializationsToMetadata(
	metadata: Record<string, unknown> | null | undefined,
	specializations: string[] | undefined,
): Record<string, unknown> | null {
	const base = metadata ? { ...metadata } : {};

	if (!specializations) {
		return Object.keys(base).length > 0 ? base : null;
	}

	const normalized = Array.from(
		new Set(
			specializations
				.map((value) => value.trim())
				.filter((value) => value.length > 0),
		),
	);

	if (normalized.length === 0) {
		delete base.specializations;
		return Object.keys(base).length > 0 ? base : null;
	}

	base.specializations = normalized;
	return base;
}

export function deriveCrewRoles({
	memberRole,
	userId,
}: {
	memberRole: string | null | undefined;
	userId: string | null | undefined;
}) {
	const memberRoles = normalizeRoles(memberRole);
	const isFreelancer = !userId || memberRoles.length === 0;
	const displayRoles = isFreelancer ? ["freelancer"] : memberRoles;
	const primaryRole = displayRoles[0] ?? "freelancer";

	return {
		memberRoles,
		displayRoles,
		isFreelancer,
		primaryRole,
	};
}
