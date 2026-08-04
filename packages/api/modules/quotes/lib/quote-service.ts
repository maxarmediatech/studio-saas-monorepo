import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull, quotes, sql } from "@repo/database";
import { trackActivityWithExecutor } from "../../activities/lib";
import type { StudioContext } from "../../studio/lib/permissions";
import type { TransactionClient } from "../../studio/lib/transactions";
import { quotationDocumentV1Schema } from "../../studio/schemas/quotation-document";
import {
	type QuoteDraftContentInput,
	quoteDraftContentInputSchema,
} from "../../studio/schemas/quote";
import { replaceNormalizedDocumentChildren } from "./quotation-document-service";
import { sendDocumentQuotation } from "./quotation-pdf-service";
import { readQuoteContent, replaceQuoteContent } from "./quote-content";
import { isQuoteExpiryDue } from "./quote-lifecycle";
import { allocateQuoteNumber } from "./quote-number";
import {
	assertLegacyDraftWriteBoundary,
	buildDocumentRevisionFields,
	resolveQuoteSendMode,
} from "./quote-service-contracts";

export type QuoteServiceContext = Pick<
	StudioContext,
	"organizationId" | "user" | "membership"
>;

type LockedQuote = typeof quotes.$inferSelect;

async function lockQuote(
	tx: TransactionClient,
	organizationId: string,
	quoteId: string,
	includeDeleted = false,
): Promise<LockedQuote> {
	const conditions = [
		eq(quotes.id, quoteId),
		eq(quotes.organizationId, organizationId),
	];
	if (!includeDeleted) {
		conditions.push(isNull(quotes.deletedAt));
	}
	const [quote] = await tx
		.select()
		.from(quotes)
		.where(and(...conditions))
		.for("update");
	if (!quote) {
		throw new ORPCError("NOT_FOUND", { message: "Quote not found" });
	}
	return quote;
}

async function recordStatus(
	tx: TransactionClient,
	context: QuoteServiceContext,
	quote: Pick<LockedQuote, "id" | "title" | "status">,
	status: LockedQuote["status"],
): Promise<void> {
	await trackActivityWithExecutor(
		tx,
		{ organizationId: context.organizationId, user: context.user },
		{
			entityType: "quote",
			entityId: quote.id,
			entityName: quote.title,
			action: "status_changed",
			field: "status",
			oldValue: quote.status,
			newValue: status,
		},
	);
}

function assertNotDue(quote: LockedQuote, now: Date): void {
	if (isQuoteExpiryDue(quote.expiresAt, now)) {
		throw new ORPCError("CONFLICT", { message: "Quote has expired" });
	}
}

export async function createDraftQuote(
	context: QuoteServiceContext,
	input: QuoteDraftContentInput,
): Promise<{ id: string; quoteNumber: string }> {
	const content = quoteDraftContentInputSchema.parse(input);
	return db.transaction(async (tx) => {
		const quoteNumber = await allocateQuoteNumber(
			tx,
			context.organizationId,
			context.membership.organization.name,
			context.membership.organization.timezone,
		);
		const now = new Date();
		const [created] = await tx
			.insert(quotes)
			.values({
				organizationId: context.organizationId,
				quoteNumber,
				version: 1,
				status: "draft",
				title: content.title,
				currency: content.currency,
				expiresAt: content.expiresAt
					? new Date(content.expiresAt)
					: null,
				terms: content.terms ?? null,
				clientMessage: content.clientMessage ?? null,
				internalNotes: content.internalNotes ?? null,
				createdBy: context.user.id,
				updatedBy: context.user.id,
				updatedAt: now,
			})
			.returning({ id: quotes.id });
		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create quote",
			});
		}
		await replaceQuoteContent(tx, {
			quoteId: created.id,
			organizationId: context.organizationId,
			content,
		});
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "quote",
				entityId: created.id,
				entityName: content.title,
				action: "created",
				metadata: { quoteNumber },
			},
		);
		return { id: created.id, quoteNumber };
	});
}

export async function updateDraftQuote(
	context: QuoteServiceContext,
	quoteId: string,
	input: QuoteDraftContentInput,
): Promise<{ id: string }> {
	const content = quoteDraftContentInputSchema.parse(input);
	return db.transaction(async (tx) => {
		const quote = await lockQuote(tx, context.organizationId, quoteId);
		assertLegacyDraftWriteBoundary(quote);
		const now = new Date();
		await tx
			.update(quotes)
			.set({
				title: content.title,
				currency: content.currency,
				expiresAt: content.expiresAt
					? new Date(content.expiresAt)
					: null,
				terms: content.terms ?? null,
				clientMessage: content.clientMessage ?? null,
				internalNotes: content.internalNotes ?? null,
				updatedBy: context.user.id,
				updatedAt: now,
			})
			.where(
				and(
					eq(quotes.id, quoteId),
					eq(quotes.organizationId, context.organizationId),
				),
			);
		await replaceQuoteContent(tx, {
			quoteId,
			organizationId: context.organizationId,
			content,
		});
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "quote",
				entityId: quoteId,
				entityName: content.title,
				action: "updated",
			},
		);
		return { id: quoteId };
	});
}

export async function deleteDraftQuote(
	context: QuoteServiceContext,
	quoteId: string,
): Promise<{ id: string }> {
	return db.transaction(async (tx) => {
		const quote = await lockQuote(
			tx,
			context.organizationId,
			quoteId,
			true,
		);
		if (quote.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Quote is already deleted",
			});
		}
		if (quote.status !== "draft") {
			throw new ORPCError("CONFLICT", {
				message: "Only draft quotes can be deleted",
			});
		}
		const now = new Date();
		await tx
			.update(quotes)
			.set({
				deletedAt: now,
				deletedBy: context.user.id,
				updatedAt: now,
				updatedBy: context.user.id,
			})
			.where(
				and(
					eq(quotes.id, quoteId),
					eq(quotes.organizationId, context.organizationId),
				),
			);
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "quote",
				entityId: quote.id,
				entityName: quote.title,
				action: "deleted",
			},
		);
		return { id: quoteId };
	});
}

async function transitionSentQuote(
	context: QuoteServiceContext,
	quoteId: string,
	target: "declined" | "expired",
): Promise<{ id: string }> {
	return db.transaction(async (tx) => {
		const quote = await lockQuote(tx, context.organizationId, quoteId);
		if (quote.status !== "sent") {
			throw new ORPCError("CONFLICT", {
				message: `Only sent quotes can be ${target}`,
			});
		}
		const now = new Date();
		if (target === "expired" && !isQuoteExpiryDue(quote.expiresAt, now)) {
			throw new ORPCError("CONFLICT", {
				message: "Quote expiry is not due",
			});
		}
		await tx
			.update(quotes)
			.set({
				status: target,
				declinedAt: target === "declined" ? now : quote.declinedAt,
				expiredAt: target === "expired" ? now : quote.expiredAt,
				updatedAt: now,
				updatedBy: context.user.id,
			})
			.where(
				and(
					eq(quotes.id, quoteId),
					eq(quotes.organizationId, context.organizationId),
				),
			);
		await recordStatus(tx, context, quote, target);
		return { id: quoteId };
	});
}

export const declineQuote = (context: QuoteServiceContext, quoteId: string) =>
	transitionSentQuote(context, quoteId, "declined");
export const expireQuote = (context: QuoteServiceContext, quoteId: string) =>
	transitionSentQuote(context, quoteId, "expired");

export async function sendQuote(
	context: QuoteServiceContext,
	quoteId: string,
): Promise<{ id: string }> {
	const documentQuote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, context.organizationId),
			isNull(quotes.deletedAt),
		),
		columns: { documentVersion: true, documentRevision: true },
	});
	if (documentQuote) {
		const mode = resolveQuoteSendMode(documentQuote);
		if (mode.kind === "document") {
			return sendDocumentQuotation(context, quoteId, mode.revision);
		}
	}
	return db.transaction(async (tx) => {
		const quote = await lockQuote(tx, context.organizationId, quoteId);
		if (quote.status !== "draft") {
			throw new ORPCError("CONFLICT", {
				message: "Only draft quotes can be sent",
			});
		}
		const now = new Date();
		assertNotDue(quote, now);
		await tx
			.update(quotes)
			.set({
				status: "sent",
				sentAt: now,
				updatedAt: now,
				updatedBy: context.user.id,
			})
			.where(
				and(
					eq(quotes.id, quoteId),
					eq(quotes.organizationId, context.organizationId),
				),
			);
		await recordStatus(tx, context, quote, "sent");
		return { id: quoteId };
	});
}

export async function reviseQuote(
	context: QuoteServiceContext,
	quoteId: string,
) {
	return db.transaction(async (tx) => {
		const quote = await lockQuote(tx, context.organizationId, quoteId);
		if (quote.status === "superseded") {
			const child = await tx.query.quotes.findFirst({
				where: and(
					eq(quotes.organizationId, context.organizationId),
					eq(quotes.supersedesQuoteId, quote.id),
				),
				columns: { id: true, quoteNumber: true, version: true },
			});
			if (!child) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Superseded quote revision is missing",
				});
			}
			return child;
		}
		if (["draft", "converted"].includes(quote.status)) {
			throw new ORPCError("CONFLICT", {
				message: `Cannot revise a ${quote.status} quote`,
			});
		}
		await tx.execute(
			sql`SELECT pg_advisory_xact_lock(hashtextextended(${`quote-revision:${context.organizationId}:${quote.quoteNumber}`}, 0))`,
		);
		const document =
			quote.documentVersion === 1
				? quotationDocumentV1Schema.parse(quote.document)
				: null;
		const content = document
			? null
			: await readQuoteContent(tx, context.organizationId, quote.id);
		const [latest] = await tx
			.select({ version: quotes.version })
			.from(quotes)
			.where(
				and(
					eq(quotes.organizationId, context.organizationId),
					eq(quotes.quoteNumber, quote.quoteNumber),
				),
			)
			.orderBy(sql`${quotes.version} DESC`)
			.limit(1);
		const version = (latest?.version ?? quote.version) + 1;
		const now = new Date();
		const [created] = await tx
			.insert(quotes)
			.values({
				organizationId: context.organizationId,
				quoteNumber: quote.quoteNumber,
				version,
				supersedesQuoteId: quote.id,
				status: "draft",
				title: document?.title ?? content?.title ?? quote.title,
				currency:
					document?.currency ?? content?.currency ?? quote.currency,
				expiresAt: content?.expiresAt
					? new Date(content.expiresAt)
					: quote.expiresAt,
				terms: content?.terms ?? null,
				clientMessage: content?.clientMessage ?? null,
				internalNotes: content?.internalNotes ?? null,
				...(document && quote.documentSha256
					? buildDocumentRevisionFields({
							document,
							documentSha256: quote.documentSha256,
						})
					: {
							documentVersion: null,
							document: null,
							documentSha256: null,
							documentRevision: 0,
						}),
				createdBy: context.user.id,
				updatedBy: context.user.id,
			})
			.returning({ id: quotes.id });
		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to revise quote",
			});
		}
		if (document) {
			await replaceNormalizedDocumentChildren(
				tx,
				context.organizationId,
				created.id,
				document,
			);
		} else if (content) {
			await replaceQuoteContent(tx, {
				quoteId: created.id,
				organizationId: context.organizationId,
				content,
			});
		}
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "quote",
				entityId: created.id,
				entityName: document?.title ?? content?.title ?? quote.title,
				action: "created",
				metadata: {
					quoteNumber: quote.quoteNumber,
					version,
					supersedesQuoteId: quote.id,
				},
			},
		);
		await tx
			.update(quotes)
			.set({
				status: "superseded",
				supersededAt: now,
				updatedAt: now,
				updatedBy: context.user.id,
			})
			.where(
				and(
					eq(quotes.id, quote.id),
					eq(quotes.organizationId, context.organizationId),
				),
			);
		await recordStatus(tx, context, quote, "superseded");
		return { id: created.id, quoteNumber: quote.quoteNumber, version };
	});
}
