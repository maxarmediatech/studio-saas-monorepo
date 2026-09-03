import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { quotationDocumentFixture } from "../pdf/quotation-pdf.fixture";
import { quotationDocumentSha256 } from "./quotation-document";

const artifactMocks = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("./quotation-render-artifact", () => ({
	renderAndStoreFrozenQuotationPdf: artifactMocks.render,
}));

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function restoreDatabaseUrl(original: string | undefined) {
	if (original === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = original;
	}
}

describePostgres("quotation presentation and render-intent concurrency", () => {
	it("serializes selection/send races and converges duplicate synchronous sends", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			db,
			eq,
			organizations,
			quotationPdfRenderIntents,
			quotes,
			users,
		} = await import("@repo/database");
		const { getQuotationPresentation, selectQuotationTemplate } =
			await import("./quotation-presentation-service");
		const { startQuotationPdfSend } = await import(
			"./quotation-render-intent-service"
		);
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `presentation_pipeline_org_${suffix}`;
		const otherOrganizationId = `presentation_pipeline_other_${suffix}`;
		const userId = `presentation_pipeline_user_${suffix}`;
		const quoteId = randomUUID();
		const raceQuoteId = randomUUID();
		const document = quotationDocumentFixture();
		const context = {
			organizationId,
			user: {
				id: userId,
				name: "Presentation pipeline user",
				email: `presentation-${suffix}@example.com`,
			},
		};
		artifactMocks.render.mockImplementation(
			async (intent: { quoteId: string }) => {
				expect(
					await db.query.quotes.findFirst({
						where: eq(quotes.id, intent.quoteId),
						columns: { status: true },
					}),
				).toMatchObject({ status: "draft" });
				return {
					storageKey: `quotations/${organizationId}/${intent.quoteId}/v1/${"a".repeat(64)}.pdf`,
					sha256: "a".repeat(64),
					pageCount: 3,
					byteSize: 4096,
					renderedAt: new Date(),
				};
			},
		);

		try {
			await db.insert(users).values({
				id: userId,
				name: context.user.name,
				email: context.user.email,
			});
			await db.insert(organizations).values([
				{
					id: organizationId,
					name: "Presentation Pipeline Studio",
					slug: `presentation-pipeline-${suffix}`,
				},
				{
					id: otherOrganizationId,
					name: "Other Presentation Studio",
					slug: `other-presentation-${suffix}`,
				},
			]);
			for (const [id, number] of [
				[quoteId, "A"],
				[raceQuoteId, "B"],
			] as const) {
				await db.insert(quotes).values({
					id,
					organizationId,
					quoteNumber: `PIPE-${number}-${suffix}`,
					version: 1,
					status: "draft",
					title: document.title,
					documentVersion: 1,
					document,
					documentSha256: quotationDocumentSha256(document),
					documentRevision: 1,
					createdBy: userId,
					updatedBy: userId,
				});
			}

			await expect(
				getQuotationPresentation(otherOrganizationId, quoteId),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			const selectionRequests = await Promise.allSettled([
				selectQuotationTemplate(context, {
					quoteId,
					expectedDocumentRevision: 1,
					expectedSelectionVersion: null,
					templateId: "classic",
					templateVersion: 1,
				}),
				selectQuotationTemplate(context, {
					quoteId,
					expectedDocumentRevision: 1,
					expectedSelectionVersion: null,
					templateId: "classic",
					templateVersion: 1,
				}),
			]);
			expect(
				selectionRequests.filter(
					({ status }) => status === "fulfilled",
				),
			).toHaveLength(1);
			const rejectedSelection = selectionRequests.find(
				(result) => result.status === "rejected",
			);
			expect(rejectedSelection).toBeDefined();
			if (rejectedSelection?.status === "rejected") {
				expect(rejectedSelection.reason).toMatchObject({
					code: "CONFLICT",
					data: {
						current: {
							documentRevision: 1,
							selectionVersion: 1,
							templateId: "classic",
							templateVersion: 1,
						},
					},
				});
			}

			const duplicateSends = await Promise.all([
				startQuotationPdfSend(context, {
					quoteId,
					expectedDocumentRevision: 1,
					expectedSelectionVersion: 1,
				}),
				startQuotationPdfSend(context, {
					quoteId,
					expectedDocumentRevision: 1,
					expectedSelectionVersion: 1,
				}),
			]);
			expect(duplicateSends[0]?.id).toBe(duplicateSends[1]?.id);
			expect(
				await db.query.quotationPdfRenderIntents.findMany({
					where: eq(quotationPdfRenderIntents.quoteId, quoteId),
				}),
			).toHaveLength(1);

			expect(
				await db.query.quotes.findFirst({
					where: eq(quotes.id, quoteId),
					columns: { status: true, pdfRenderIntentId: true },
				}),
			).toMatchObject({
				status: "sent",
				pdfRenderIntentId: duplicateSends[0]?.id,
			});

			await selectQuotationTemplate(context, {
				quoteId: raceQuoteId,
				expectedDocumentRevision: 1,
				expectedSelectionVersion: null,
				templateId: "classic",
				templateVersion: 1,
			});
			const race = await Promise.allSettled([
				startQuotationPdfSend(context, {
					quoteId: raceQuoteId,
					expectedDocumentRevision: 1,
					expectedSelectionVersion: 1,
				}),
				selectQuotationTemplate(context, {
					quoteId: raceQuoteId,
					expectedDocumentRevision: 1,
					expectedSelectionVersion: 1,
					templateId: "classic",
					templateVersion: 1,
				}),
			]);
			expect(
				race.filter(({ status }) => status === "fulfilled"),
			).toHaveLength(1);
			expect(
				race.filter(({ status }) => status === "rejected"),
			).toHaveLength(1);
		} finally {
			artifactMocks.render.mockReset();
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db
				.delete(organizations)
				.where(eq(organizations.id, otherOrganizationId));
			await db.delete(users).where(eq(users.id, userId));
			restoreDatabaseUrl(originalDatabaseUrl);
		}
	}, 30_000);

	it("returns a failed render to draft and resumes the same frozen intent", async () => {
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
		const { processQuotationPdfRenderIntent } = await import(
			"./quotation-render-worker"
		);
		const { returnQuotationPdfRenderToDraft, startQuotationPdfSend } =
			await import("./quotation-render-intent-service");
		const suffix = `${process.pid}_${Date.now()}_worker`;
		const organizationId = `render_worker_org_${suffix}`;
		const userId = `render_worker_user_${suffix}`;
		const quoteId = randomUUID();
		const intentId = randomUUID();
		const document = quotationDocumentFixture();
		const branding = {
			schemaVersion: 1 as const,
			organizationName: "Render Worker Studio",
			address: null,
			email: null,
			phone: null,
			taxIdentifier: null,
			timezone: "UTC",
			logoStorageKey: null,
			logoMimeType: null,
			logoSha256: null,
		};
		const artifact = {
			storageKey: `quotations/${organizationId}/${quoteId}/v1/${"c".repeat(64)}.pdf`,
			sha256: "c".repeat(64),
			pageCount: 3,
			byteSize: 4096,
			renderedAt: new Date("2026-08-10T00:00:00.000Z"),
		};
		const context = {
			organizationId,
			user: {
				id: userId,
				name: "Render user",
				email: `render-worker-${suffix}@example.com`,
			},
		};

		try {
			await db.insert(users).values({
				id: userId,
				name: "Render worker user",
				email: `render-worker-${suffix}@example.com`,
			});
			await db.insert(organizations).values({
				id: organizationId,
				name: "Render Worker Studio",
				slug: `render-worker-${suffix}`,
			});
			await db.insert(quotes).values({
				id: quoteId,
				organizationId,
				quoteNumber: `WORK-${suffix}`,
				version: 1,
				status: "draft",
				title: document.title,
				documentVersion: 1,
				document,
				documentSha256: quotationDocumentSha256(document),
				documentRevision: 1,
				createdBy: userId,
				updatedBy: userId,
			});
			await db.insert(quotationPresentations).values({
				quoteId,
				organizationId,
				templateId: "classic",
				templateVersion: 1,
				selectionVersion: 1,
				selectedBy: userId,
			});
			await db.insert(quotationPdfRenderIntents).values({
				id: intentId,
				organizationId,
				quoteId,
				quoteVersion: 1,
				documentRevision: 1,
				selectionVersion: 1,
				sourceDocument: {
					schemaVersion: 1,
					document,
					quoteNumber: `WORK-${suffix}`,
					quoteVersion: 1,
					validUntil: null,
					createdAt: new Date().toISOString(),
				},
				sourceFingerprint: quotationDocumentSha256(document),
				brandingSnapshot: branding,
				brandingFingerprint: "b".repeat(64),
				templateId: "classic",
				templateVersion: 1,
				copyProfileVersion: 1,
				composerVersion: 1,
				rendererVersion: "quotation-pdf-v1",
				idempotencyKey: `${quoteId}:1:1`,
				status: "pending",
			});
			await db
				.update(quotes)
				.set({ status: "preparing" })
				.where(eq(quotes.id, quoteId));
			artifactMocks.render.mockRejectedValueOnce(
				new Error("Storage unavailable"),
			);
			await expect(
				processQuotationPdfRenderIntent(intentId),
			).rejects.toThrow("Storage unavailable");
			expect(
				await db.query.quotationPdfRenderIntents.findFirst({
					where: eq(quotationPdfRenderIntents.id, intentId),
					columns: { status: true, attemptCount: true },
				}),
			).toMatchObject({ status: "failed", attemptCount: 1 });
			await expect(
				returnQuotationPdfRenderToDraft(context, {
					quoteId,
					renderIntentId: intentId,
					expectedDocumentRevision: 1,
					expectedSelectionVersion: 1,
				}),
			).resolves.toMatchObject({
				id: intentId,
				status: "returned_to_draft",
			});

			artifactMocks.render.mockResolvedValue(artifact);
			await expect(
				startQuotationPdfSend(context, {
					quoteId,
					expectedDocumentRevision: 1,
					expectedSelectionVersion: 1,
				}),
			).resolves.toMatchObject({ id: intentId, status: "completed" });
			await expect(
				processQuotationPdfRenderIntent(intentId),
			).resolves.toEqual({ id: intentId, status: "completed" });
			expect(
				await db.query.quotes.findFirst({
					where: eq(quotes.id, quoteId),
					columns: {
						status: true,
						pdfRenderIntentId: true,
						pdfStorageKey: true,
						pdfSha256: true,
					},
				}),
			).toMatchObject({
				status: "sent",
				pdfRenderIntentId: intentId,
				pdfStorageKey: artifact.storageKey,
				pdfSha256: artifact.sha256,
			});
		} finally {
			artifactMocks.render.mockReset();
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db.delete(users).where(eq(users.id, userId));
			restoreDatabaseUrl(originalDatabaseUrl);
		}
	}, 30_000);
});
