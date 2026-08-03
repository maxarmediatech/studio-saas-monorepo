import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { QuotationDocumentV1 } from "../../studio/schemas/quotation-document";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("quotation configuration tenant isolation", () => {
	it("rejects IDs and keys owned by another organization", async () => {
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
					type: "booking_type",
					key: "foreign-wedding",
					label: "Foreign wedding",
				})
				.returning({ id: configurations.id });
			if (!foreign) {
				throw new Error("Missing configuration fixture");
			}
			const document = {
				schemaVersion: 1,
				quotationDate: "",
				quotationType: {
					id: foreign.id,
					key: "foreign-wedding",
					label: "Forged label",
				},
				title: "",
				currency: "INR",
				participants: [],
				events: [],
				packages: [],
				recommendedPackageKey: null,
				deliveryTimelines: [],
				paymentMilestones: [],
				fixedTerms: [],
			} satisfies QuotationDocumentV1;
			await expect(
				db.transaction((tx) =>
					validateQuotationConfigurationReferences(
						tx,
						organizationId,
						document,
					),
				),
			).rejects.toThrow(/configuration is invalid/);
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
