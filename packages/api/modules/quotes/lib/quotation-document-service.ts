import { TZDate } from "@date-fns/tz";
import { ORPCError } from "@orpc/server";
import {
	and,
	clients,
	configurations,
	db,
	eq,
	ilike,
	isNull,
	or,
	quotes,
	sql,
} from "@repo/database";
import { trackActivityWithExecutor } from "../../activities/lib";
import { addDays } from "../../studio/lib/date-helpers";
import type { StudioContext } from "../../studio/lib/permissions";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { QuotationDocumentV1 } from "../../studio/schemas/quotation-document";
import { quotationDocumentV1Schema } from "../../studio/schemas/quotation-document";
import {
	normalizeQuotationDocument,
	quotationDocumentSha256,
} from "./quotation-document";
import { replaceNormalizedDocumentChildren } from "./quotation-document-normalization";
import { allocateQuoteNumber } from "./quote-number";

export { replaceNormalizedDocumentChildren };

type Context = Pick<StudioContext, "organizationId" | "membership" | "user">;

type QuotationConfigurationType =
	| "booking_type"
	| "event_type"
	| "package_type";

type ConfigurationReference = {
	id: string | null;
	key: string | null;
	type: QuotationConfigurationType;
};

export function getQuotationConfigurationReferences(
	document: QuotationDocumentV1,
): ConfigurationReference[] {
	const references: ConfigurationReference[] = [];
	if (document.quotationType.id || document.quotationType.key) {
		references.push({
			id: document.quotationType.id,
			key: document.quotationType.key,
			type: "booking_type",
		});
	}
	for (const event of document.events) {
		if (event.eventType.id || event.eventType.key) {
			references.push({
				id: event.eventType.id,
				key: event.eventType.key,
				type: "event_type",
			});
		}
	}
	for (const pkg of document.packages) {
		if (pkg.configuration?.id || pkg.configuration?.key) {
			references.push({
				id: pkg.configuration.id,
				key: pkg.configuration.key,
				type: "package_type",
			});
		}
	}
	return references;
}

export async function validateQuotationConfigurationReferences(
	tx: TransactionClient,
	organizationId: string,
	document: QuotationDocumentV1,
	previousDocument?: QuotationDocumentV1,
): Promise<void> {
	const previous = new Set(
		(previousDocument
			? getQuotationConfigurationReferences(previousDocument)
			: []
		).map(({ id, key, type }) => `${type}:${id}:${key ?? ""}`),
	);
	for (const reference of getQuotationConfigurationReferences(document)) {
		const found = await tx.query.configurations.findFirst({
			where: and(
				reference.id ? eq(configurations.id, reference.id) : undefined,
				eq(configurations.organizationId, organizationId),
				eq(configurations.type, reference.type),
				reference.key
					? eq(configurations.key, reference.key)
					: undefined,
			),
			columns: { id: true },
		});
		if (
			!found &&
			!previous.has(
				`${reference.type}:${reference.id}:${reference.key ?? ""}`,
			)
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Quotation ${reference.type} configuration is invalid`,
			});
		}
	}
}

function contactMetadata(
	contact: QuotationDocumentV1["participants"][number]["contact"],
): Record<string, string> | null {
	const values = {
		profession: contact.profession,
		source: contact.source,
		socialHandle: contact.socialHandle,
		notes: contact.notes,
	};
	const metadata = Object.fromEntries(
		Object.entries(values).filter((entry): entry is [string, string] =>
			Boolean(entry[1]),
		),
	);
	return Object.keys(metadata).length > 0 ? metadata : null;
}

async function duplicateContact(
	tx: TransactionClient,
	organizationId: string,
	contact: QuotationDocumentV1["participants"][number]["contact"],
	excludeId?: string,
) {
	const matches = [
		contact.email ? eq(clients.email, contact.email) : undefined,
		contact.phoneNumber
			? eq(clients.phoneNumber, contact.phoneNumber)
			: undefined,
	].filter((condition): condition is NonNullable<typeof condition> =>
		Boolean(condition),
	);
	if (matches.length === 0) {
		return null;
	}
	return tx.query.clients.findFirst({
		where: and(
			eq(clients.organizationId, organizationId),
			isNull(clients.deletedAt),
			excludeId ? sql`${clients.id} <> ${excludeId}` : undefined,
			or(...matches),
		),
		columns: { id: true, name: true, lifecycleStage: true },
	});
}

async function resolveParticipants(
	tx: TransactionClient,
	context: Context,
	document: QuotationDocumentV1,
): Promise<QuotationDocumentV1> {
	const participants = [];
	for (const participant of document.participants) {
		if (!participant.contact.name.trim()) {
			participants.push(participant);
			continue;
		}
		if (!participant.clientId) {
			const duplicate = await duplicateContact(
				tx,
				context.organizationId,
				participant.contact,
			);
			if (duplicate) {
				throw new ORPCError("CONFLICT", {
					message: `Contact matches ${duplicate.name} (${duplicate.lifecycleStage}); select the existing CRM record`,
				});
			}
			const now = new Date();
			const [created] = await tx
				.insert(clients)
				.values({
					organizationId: context.organizationId,
					lifecycleStage: "lead",
					name: participant.contact.name,
					email: participant.contact.email,
					phoneNumber: participant.contact.phoneNumber,
					alternatePhone: participant.contact.alternatePhone,
					address: participant.contact.address,
					metadata: contactMetadata(participant.contact),
					createdBy: context.user.id,
					updatedBy: context.user.id,
					createdAt: now,
					updatedAt: now,
				})
				.returning({ id: clients.id, updatedAt: clients.updatedAt });
			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create lead",
				});
			}
			await trackActivityWithExecutor(
				tx,
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "client",
					entityId: created.id,
					entityName: participant.contact.name,
					action: "created",
					metadata: { lifecycleStage: "lead", source: "quotation" },
				},
			);
			participants.push({
				...participant,
				clientId: created.id,
				clientUpdatedAt: created.updatedAt.toISOString(),
			});
			continue;
		}

		const [existing] = await tx
			.select()
			.from(clients)
			.where(
				and(
					eq(clients.id, participant.clientId),
					eq(clients.organizationId, context.organizationId),
					isNull(clients.deletedAt),
				),
			)
			.for("update");
		if (!existing) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Quotation client not found",
			});
		}
		if (existing.lifecycleStage === "lead") {
			if (
				!participant.clientUpdatedAt ||
				existing.updatedAt.toISOString() !== participant.clientUpdatedAt
			) {
				throw new ORPCError("CONFLICT", {
					message: `${existing.name} changed in CRM; reload before saving`,
				});
			}
			const duplicate = await duplicateContact(
				tx,
				context.organizationId,
				participant.contact,
				existing.id,
			);
			if (duplicate) {
				throw new ORPCError("CONFLICT", {
					message: `Contact matches ${duplicate.name}; select the existing CRM record`,
				});
			}
			const now = new Date();
			await tx
				.update(clients)
				.set({
					name: participant.contact.name,
					email: participant.contact.email,
					phoneNumber: participant.contact.phoneNumber,
					alternatePhone: participant.contact.alternatePhone,
					address: participant.contact.address,
					metadata: contactMetadata(participant.contact),
					updatedAt: now,
					updatedBy: context.user.id,
				})
				.where(eq(clients.id, existing.id));
			participants.push({
				...participant,
				clientUpdatedAt: now.toISOString(),
			});
		} else {
			participants.push({
				...participant,
				clientUpdatedAt: existing.updatedAt.toISOString(),
			});
		}
	}
	return { ...document, participants };
}

function expiryForDocument(
	document: QuotationDocumentV1,
	timezone: string,
): Date | null {
	if (!document.quotationDate) {
		return null;
	}
	const expiryDate = addDays(document.quotationDate, 14);
	const [year, month, day] = expiryDate.split("-").map(Number);
	return new TZDate(year, month - 1, day, 23, 59, 59, 999, timezone);
}

export async function createDocumentDraft(context: Context, input: unknown) {
	const parsed = normalizeQuotationDocument(
		quotationDocumentV1Schema.parse(input),
	);
	return db.transaction(async (tx) => {
		await validateQuotationConfigurationReferences(
			tx,
			context.organizationId,
			parsed,
		);
		const document = await resolveParticipants(tx, context, parsed);
		const quoteNumber = await allocateQuoteNumber(
			tx,
			context.organizationId,
			context.membership.organization.name,
			context.membership.organization.timezone,
		);
		const hash = quotationDocumentSha256(document);
		const [created] = await tx
			.insert(quotes)
			.values({
				organizationId: context.organizationId,
				quoteNumber,
				version: 1,
				status: "draft",
				title: document.title,
				currency: "INR",
				expiresAt: expiryForDocument(
					document,
					context.membership.organization.timezone,
				),
				documentVersion: 1,
				document,
				documentSha256: hash,
				documentRevision: 1,
				createdBy: context.user.id,
				updatedBy: context.user.id,
			})
			.returning({ id: quotes.id });
		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create quotation",
			});
		}
		await replaceNormalizedDocumentChildren(
			tx,
			context.organizationId,
			created.id,
			document,
		);
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "quote",
				entityId: created.id,
				entityName: document.title,
				action: "created",
				metadata: { documentVersion: 1, documentRevision: 1 },
			},
		);
		return { id: created.id, documentRevision: 1, document };
	});
}

export async function saveDocumentDraft(
	context: Context,
	quoteId: string,
	expectedRevision: number,
	input: unknown,
) {
	const parsed = normalizeQuotationDocument(
		quotationDocumentV1Schema.parse(input),
	);
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ document: quotes.document })
			.from(quotes)
			.where(
				and(
					eq(quotes.id, quoteId),
					eq(quotes.organizationId, context.organizationId),
					eq(quotes.status, "draft"),
					eq(quotes.documentVersion, 1),
					eq(quotes.documentRevision, expectedRevision),
					isNull(quotes.deletedAt),
				),
			)
			.for("update");
		if (!current) {
			throw new ORPCError("CONFLICT", {
				message: "Quotation draft changed in another editor",
			});
		}
		const previousDocument = quotationDocumentV1Schema.parse(
			current.document,
		);
		await validateQuotationConfigurationReferences(
			tx,
			context.organizationId,
			parsed,
			previousDocument,
		);
		const document = await resolveParticipants(tx, context, parsed);
		const hash = quotationDocumentSha256(document);
		const [updated] = await tx
			.update(quotes)
			.set({
				title: document.title,
				expiresAt: expiryForDocument(
					document,
					context.membership.organization.timezone,
				),
				document: document,
				documentSha256: hash,
				documentRevision: expectedRevision + 1,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(
				and(
					eq(quotes.id, quoteId),
					eq(quotes.organizationId, context.organizationId),
					eq(quotes.status, "draft"),
					eq(quotes.documentVersion, 1),
					eq(quotes.documentRevision, expectedRevision),
					isNull(quotes.deletedAt),
				),
			)
			.returning({ revision: quotes.documentRevision });
		if (!updated) {
			throw new ORPCError("CONFLICT", {
				message: "Quotation draft changed in another editor",
			});
		}
		await replaceNormalizedDocumentChildren(
			tx,
			context.organizationId,
			quoteId,
			document,
		);
		return { id: quoteId, documentRevision: updated.revision, document };
	});
}

export async function searchQuotationContacts(
	organizationId: string,
	query: string,
	limit: number,
) {
	const pattern = `%${query}%`;
	const rows = await db.query.clients.findMany({
		where: and(
			eq(clients.organizationId, organizationId),
			isNull(clients.deletedAt),
			or(
				ilike(clients.name, pattern),
				ilike(clients.email, pattern),
				ilike(clients.phoneNumber, pattern),
			),
		),
		orderBy: (table, { asc, desc }) => [
			asc(table.lifecycleStage),
			desc(table.createdAt),
		],
		limit,
	});
	const serialize = (row: (typeof rows)[number]) => ({
		id: row.id,
		lifecycleStage: row.lifecycleStage,
		name: row.name,
		email: row.email,
		phoneNumber: row.phoneNumber,
		alternatePhone: row.alternatePhone,
		address: row.address,
		metadata: row.metadata as Record<string, unknown> | null,
		updatedAt: row.updatedAt.toISOString(),
	});
	return {
		leads: rows
			.filter(({ lifecycleStage }) => lifecycleStage === "lead")
			.map(serialize),
		clients: rows
			.filter(({ lifecycleStage }) => lifecycleStage === "client")
			.map(serialize),
	};
}
