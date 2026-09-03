import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function restoreDatabaseUrl(original: string | undefined) {
	if (original === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = original;
	}
}

function frozenIntent(params: {
	id: string;
	organizationId: string;
	quoteId: string;
	documentRevision?: number;
	selectionVersion?: number;
}) {
	const documentRevision = params.documentRevision ?? 1;
	const selectionVersion = params.selectionVersion ?? 1;
	return {
		id: params.id,
		organizationId: params.organizationId,
		quoteId: params.quoteId,
		quoteVersion: 1,
		documentRevision,
		selectionVersion,
		sourceDocument: { schemaVersion: 1, title: "Frozen quotation" },
		sourceFingerprint: "a".repeat(64),
		brandingSnapshot: {
			schemaVersion: 1,
			organizationName: "Studio",
			address: null,
			email: null,
			phone: null,
			taxIdentifier: null,
			timezone: "Asia/Kolkata",
			logoStorageKey: null,
			logoMimeType: null,
			logoSha256: null,
		},
		brandingFingerprint: "b".repeat(64),
		templateId: "classic",
		templateVersion: 1,
		copyProfileVersion: 1,
		composerVersion: 1,
		rendererVersion: "quotation-pdf-v1",
		idempotencyKey: `${params.quoteId}:${documentRevision}:${selectionVersion}`,
	};
}

describePostgres("quotation template persistence integrity", () => {
	it("enforces tenant, lifecycle, idempotency, and immutable provenance", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			db,
			eq,
			organizations,
			quotationPdfRenderIntents,
			quotationPresentations,
			quotes,
			users,
		} = await import("@repo/database");
		const { getOrganizationQuote } = await import("./quote-query");
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `template_provenance_org_${suffix}`;
		const otherOrganizationId = `template_provenance_other_${suffix}`;
		const userId = `template_provenance_user_${suffix}`;
		const quoteId = randomUUID();
		const intentId = randomUUID();
		const artifact = {
			storageKey: `quotations/${organizationId}/${quoteId}/v1/evidence.pdf`,
			sha256: "c".repeat(64),
			renderedAt: new Date("2026-08-10T00:00:00.000Z"),
			pageCount: 2,
			byteSize: 2048,
		};

		try {
			await db.insert(users).values({
				id: userId,
				name: "Template provenance user",
				email: `template-provenance-${suffix}@example.com`,
			});
			await db.insert(organizations).values([
				{
					id: organizationId,
					name: "Template Provenance Studio",
					slug: `template-provenance-${suffix}`,
				},
				{
					id: otherOrganizationId,
					name: "Other Template Studio",
					slug: `template-provenance-other-${suffix}`,
				},
			]);
			await db.insert(quotes).values({
				id: quoteId,
				organizationId,
				quoteNumber: `TP-${suffix}`,
				version: 1,
				status: "draft",
				title: "Template provenance quote",
				documentRevision: 1,
			});

			await expect(
				db.insert(quotationPresentations).values({
					quoteId,
					organizationId: otherOrganizationId,
					templateId: "classic",
					templateVersion: 1,
					selectionVersion: 1,
					selectedBy: userId,
				}),
			).rejects.toThrow();
			await db.insert(quotationPresentations).values({
				quoteId,
				organizationId,
				templateId: "classic",
				templateVersion: 1,
				selectionVersion: 1,
				selectedBy: userId,
			});
			await expect(
				db.insert(quotationPresentations).values({
					quoteId,
					organizationId,
					templateId: "classic",
					templateVersion: 1,
					selectionVersion: 2,
					selectedBy: userId,
				}),
			).rejects.toThrow();
			expect(
				(await getOrganizationQuote(organizationId, quoteId))
					.presentation,
			).toMatchObject({
				templateId: "classic",
				templateVersion: 1,
				selectionVersion: 1,
				selectedBy: userId,
			});

			await expect(
				db.insert(quotationPdfRenderIntents).values(
					frozenIntent({
						id: randomUUID(),
						organizationId: otherOrganizationId,
						quoteId,
					}),
				),
			).rejects.toThrow();
			const intent = frozenIntent({
				id: intentId,
				organizationId,
				quoteId,
			});
			await db.insert(quotationPdfRenderIntents).values(intent);
			await expect(
				db.insert(quotationPdfRenderIntents).values({
					...intent,
					id: randomUUID(),
				}),
			).rejects.toThrow();
			await expect(
				db
					.update(quotationPdfRenderIntents)
					.set({ sourceFingerprint: "d".repeat(64) })
					.where(eq(quotationPdfRenderIntents.id, intentId)),
			).rejects.toThrow();
			await db
				.update(quotationPdfRenderIntents)
				.set({ attemptCount: 1, taskId: "task-1" })
				.where(eq(quotationPdfRenderIntents.id, intentId));

			await db
				.update(quotes)
				.set({ status: "preparing" })
				.where(eq(quotes.id, quoteId));
			await expect(
				db
					.update(quotes)
					.set({ brandingSnapshot: intent.brandingSnapshot })
					.where(eq(quotes.id, quoteId)),
			).rejects.toThrow();
			await expect(
				db
					.update(quotationPresentations)
					.set({ selectionVersion: 2 })
					.where(eq(quotationPresentations.quoteId, quoteId)),
			).rejects.toThrow();
			await expect(
				db
					.delete(quotationPresentations)
					.where(eq(quotationPresentations.quoteId, quoteId)),
			).rejects.toThrow();

			await db.transaction(async (tx) => {
				await tx
					.update(quotationPdfRenderIntents)
					.set({
						status: "completed",
						artifactStorageKey: artifact.storageKey,
						artifactSha256: artifact.sha256,
						artifactRenderedAt: artifact.renderedAt,
						artifactPageCount: artifact.pageCount,
						artifactByteSize: artifact.byteSize,
						completedAt: artifact.renderedAt,
					})
					.where(eq(quotationPdfRenderIntents.id, intentId));
				await tx
					.update(quotes)
					.set({
						status: "sent",
						brandingSnapshot: intent.brandingSnapshot,
						pdfStorageKey: artifact.storageKey,
						pdfSha256: artifact.sha256,
						pdfRenderedAt: artifact.renderedAt,
						pdfRendererVersion: intent.rendererVersion,
						pdfPageCount: artifact.pageCount,
						pdfByteSize: artifact.byteSize,
						pdfRenderIntentId: intentId,
					})
					.where(eq(quotes.id, quoteId));
			});

			const detail = await getOrganizationQuote(organizationId, quoteId);
			expect(detail.pdfSnapshot?.provenance).toMatchObject({
				renderIntentId: intentId,
				templateId: "classic",
				templateVersion: 1,
				documentRevision: 1,
				selectionVersion: 1,
			});
			await expect(
				db
					.update(quotationPdfRenderIntents)
					.set({ attemptCount: 2 })
					.where(eq(quotationPdfRenderIntents.id, intentId)),
			).rejects.toThrow();
			await expect(
				db
					.delete(quotationPdfRenderIntents)
					.where(eq(quotationPdfRenderIntents.id, intentId)),
			).rejects.toThrow();
			await db
				.update(quotes)
				.set({ status: "accepted" })
				.where(eq(quotes.id, quoteId));
			await expect(
				db
					.update(quotes)
					.set({ pdfSha256: "e".repeat(64) })
					.where(eq(quotes.id, quoteId)),
			).rejects.toThrow();

			const competing = frozenIntent({
				id: randomUUID(),
				organizationId,
				quoteId,
				documentRevision: 2,
				selectionVersion: 2,
			});
			await db.insert(quotationPdfRenderIntents).values(competing);
			await expect(
				db
					.update(quotationPdfRenderIntents)
					.set({
						status: "completed",
						artifactStorageKey: `${artifact.storageKey}.other`,
						artifactSha256: "f".repeat(64),
						artifactRenderedAt: artifact.renderedAt,
						artifactPageCount: 1,
						artifactByteSize: 1024,
						completedAt: artifact.renderedAt,
					})
					.where(eq(quotationPdfRenderIntents.id, competing.id)),
			).rejects.toThrow();
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db
				.delete(organizations)
				.where(eq(organizations.id, otherOrganizationId));
			await db.delete(users).where(eq(users.id, userId));
			restoreDatabaseUrl(originalDatabaseUrl);
		}
	});
});
