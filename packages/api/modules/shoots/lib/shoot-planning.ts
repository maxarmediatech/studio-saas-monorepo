import { z } from "zod";

const shootPlanningMetadataSchema = z.object({
	requiredCrewCount: z.number().int().positive().nullable().optional(),
	additionalServices: z.array(z.string()).optional(),
});

export interface ShootPlanningFields {
	requiredCrewCount: number | null;
	additionalServices: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractShootPlanningFields(
	metadata: unknown,
): ShootPlanningFields {
	const parsed = shootPlanningMetadataSchema.safeParse(metadata);

	if (!parsed.success) {
		return {
			requiredCrewCount: null,
			additionalServices: [],
		};
	}

	return {
		requiredCrewCount: parsed.data.requiredCrewCount ?? null,
		additionalServices: parsed.data.additionalServices ?? [],
	};
}

export function buildShootPlanningMetadata(
	existingMetadata: unknown,
	input: {
		requiredCrewCount?: number | null;
		additionalServices?: string[];
	},
): Record<string, unknown> | null {
	const metadata = isPlainObject(existingMetadata)
		? { ...existingMetadata }
		: {};

	if (input.requiredCrewCount !== undefined) {
		if (input.requiredCrewCount == null) {
			delete metadata.requiredCrewCount;
		} else {
			metadata.requiredCrewCount = input.requiredCrewCount;
		}
	}

	if (input.additionalServices !== undefined) {
		const services = input.additionalServices ?? [];
		if (services.length === 0) {
			delete metadata.additionalServices;
		} else {
			metadata.additionalServices = services;
		}
	}

	return Object.keys(metadata).length > 0 ? metadata : null;
}
