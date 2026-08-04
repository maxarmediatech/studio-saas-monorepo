import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { QuotationDocumentV1 } from "../../studio/schemas/quotation-document";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("quotation configuration tenant isolation", () => {
	it("rejects foreign references and grandfathers removed local references", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const { configurations, db, organizations } = await import(
			"@repo/database"
		);
		const { validateQuotationConfigurationReferences } = await import(
			"./quotation-document-service"
		);
		const suffix = randomUUID();
		const organizationId = `quotation-config-${suffix}`;
		const otherOrganizationId = `quotation-config-other-${suffix}`;
		try {
			await db.insert(organizations).values([
				{
					id: organizationId,
					name: "Quotation config studio",
					slug: `quotation-config-${suffix}`,
				},
				{
					id: otherOrganizationId,
					name: "Other config studio",
					slug: `quotation-config-other-${suffix}`,
				},
			]);
			const [foreign] = await db
				.insert(configurations)
				.values({
					organizationId: otherOrganizationId,
					type: "quotation_terms",
					key: "foreign-terms",
					label: "Foreign terms",
				})
				.returning({ id: configurations.id });
			if (!foreign) {
				throw new Error("Missing configuration fixture");
			}
			const [local] = await db
				.insert(configurations)
				.values({
					organizationId,
					type: "quotation_terms",
					key: "local-terms",
					label: "Local terms",
				})
				.returning({ id: configurations.id });
			if (!local) {
				throw new Error("Missing local configuration fixture");
			}
			const baseDocument = {
				schemaVersion: 1,
				quotationDate: "",
				quotationType: {
					id: null,
					key: null,
					label: "Wedding",
				},
				title: "",
				currency: "INR",
				participants: [],
				events: [],
				packages: [],
				recommendedPackageKey: null,
				termsConfiguration: null,
				deliveryTimelines: [],
				paymentMilestones: [],
				fixedTerms: [],
			} satisfies QuotationDocumentV1;
			const foreignDocument = {
				...baseDocument,
				termsConfiguration: {
					id: foreign.id,
					key: "foreign-terms",
					label: "Forged terms",
					metadataVersion: 1,
				},
			} satisfies QuotationDocumentV1;
			await expect(
				db.transaction((tx) =>
					validateQuotationConfigurationReferences(
						tx,
						organizationId,
						foreignDocument,
					),
				),
			).rejects.toThrow(/configuration is invalid/);

			const localDocument = {
				...baseDocument,
				termsConfiguration: {
					id: local.id,
					key: "local-terms",
					label: "Local terms",
					metadataVersion: 1,
				},
			} satisfies QuotationDocumentV1;
			await expect(
				db.transaction((tx) =>
					validateQuotationConfigurationReferences(
						tx,
						organizationId,
						localDocument,
					),
				),
			).resolves.toBeUndefined();

			await db
				.delete(configurations)
				.where(
					(await import("@repo/database")).eq(
						configurations.id,
						local.id,
					),
				);
			await expect(
				db.transaction((tx) =>
					validateQuotationConfigurationReferences(
						tx,
						organizationId,
						localDocument,
					),
				),
			).rejects.toThrow(/configuration is invalid/);
			await expect(
				db.transaction((tx) =>
					validateQuotationConfigurationReferences(
						tx,
						organizationId,
						localDocument,
						localDocument,
					),
				),
			).resolves.toBeUndefined();
		} finally {
			await db
				.delete(organizations)
				.where(
					(await import("@repo/database")).inArray(organizations.id, [
						organizationId,
						otherOrganizationId,
					]),
				);
			if (originalDatabaseUrl === undefined) {
				delete process.env.DATABASE_URL;
			} else {
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		}
	});
});
