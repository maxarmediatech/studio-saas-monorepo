import { ORPCError } from "@orpc/server";
import { and, configurations, eq } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { ConfigType } from "../../studio/schemas/common";
import { parseConfigurationMetadata } from "../../studio/schemas/configuration";

export async function validateConfigurationFields(
	tx: TransactionClient,
	organizationId: string,
	type: ConfigType,
	metadata: Record<string, unknown> | null | undefined,
	bookingTypeFilter: string | null | undefined,
): Promise<Record<string, unknown> | null | undefined> {
	let parsedMetadata: Record<string, unknown> | null | undefined;
	try {
		parsedMetadata = parseConfigurationMetadata(type, metadata) as
			| Record<string, unknown>
			| null
			| undefined;
	} catch (error) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				error instanceof Error
					? `Invalid ${type} metadata: ${error.message}`
					: `Invalid ${type} metadata`,
		});
	}

	if (type !== "quotation_terms" || !bookingTypeFilter) {
		return parsedMetadata;
	}

	const bookingType = await tx.query.configurations.findFirst({
		where: and(
			eq(configurations.organizationId, organizationId),
			eq(configurations.type, "booking_type"),
			eq(configurations.key, bookingTypeFilter),
		),
		columns: { id: true },
	});
	if (!bookingType) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Quotation terms booking type filter is invalid",
		});
	}

	return parsedMetadata;
}
