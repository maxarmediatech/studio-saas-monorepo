import { beforeAll, describe, expect, it } from "vitest";
import type { QuotationDocumentV1 } from "../../studio/schemas/quotation-document";

beforeAll(() => {
	process.env.BETTER_AUTH_SECRET ??=
		"test-secret-at-least-32-characters-long";
	process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
	process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
});

describe("quotation contact resolution", () => {
	it("preserves unresolved typed fields without accessing CRM storage", async () => {
		const { resolveParticipants } = await import(
			"./quotation-document-service"
		);
		const participant = {
			key: "participant-1",
			clientId: null,
			clientUpdatedAt: null,
			resolutionIntent: "none" as const,
			contact: {
				name: "Client one",
				email: "client@example.com",
				phoneNumber: "+919876543210",
				alternatePhone: null,
				address: null,
				profession: null,
				source: null,
				socialHandle: null,
				notes: null,
			},
		};
		const document = { participants: [participant] } as QuotationDocumentV1;
		const storage = new Proxy(
			{},
			{
				get() {
					throw new Error("CRM storage must not be accessed");
				},
			},
		);

		await expect(
			resolveParticipants(storage as never, {} as never, document),
		).resolves.toMatchObject({ participants: [participant] });
	});
});
