import { describe, expect, it, vi } from "vitest";
import {
	buildQuotationEditorHandoffRequest,
	createRemoteQuotationEditorHandoff,
} from "./quotation-editor-handoff";

const document = {
	schemaVersion: 1 as const,
	quotationDate: "2026-09-03",
	quotationType: { id: null, key: "wedding", label: "Wedding" },
	title: "Nisha and Arjun",
	currency: "INR" as const,
	participants: [
		{
			key: "client-1",
			clientId: "client-record-1",
			clientUpdatedAt: null,
			contact: {
				name: "Nisha",
				email: null,
				phoneNumber: null,
				alternatePhone: null,
				address: null,
				profession: null,
				source: null,
				socialHandle: null,
				notes: null,
			},
		},
	],
	events: [
		{
			key: "event-1",
			eventType: { id: null, key: "wedding", label: "Wedding" },
			side: "common" as const,
			guestCount: null,
			timelineMode: "fixed" as const,
			fixedDate: "2026-12-01",
			dateWindow: null,
			location: null,
			notes: null,
		},
	],
	packages: [
		{
			key: "package-1",
			configuration: null,
			name: "Wedding story",
			price: "100000",
			summary: null,
			coverage: [{ key: "coverage-1", eventKey: "event-1", roles: null }],
			deliverables: [
				{
					key: "deliverable-1",
					name: "Photographs",
					quantity: 1,
					details: null,
				},
			],
		},
	],
	recommendedPackageKey: "package-1",
	deliveryTimelines: [],
	paymentMilestones: [
		{ key: "one", label: "Booking", percentage: "30", timing: "Now" },
		{ key: "two", label: "Event", percentage: "40", timing: "Event" },
		{
			key: "three",
			label: "Delivery",
			percentage: "30",
			timing: "Delivery",
		},
	],
	fixedTerms: [],
};

describe("quotation editor handoff", () => {
	it("maps the saved quotation into the Studio composition contract", () => {
		const request = buildQuotationEditorHandoffRequest({
			quote: {
				id: "quotation-1",
				quoteNumber: "QT-001",
				version: 2,
				documentRevision: 7,
				document,
				expiresAt: new Date("2026-09-30T18:30:00.000Z"),
				createdAt: new Date("2026-09-03T04:00:00.000Z"),
			},
			branding: {
				organizationName: "Studio Nisha",
				address: null,
				email: "hello@example.com",
				phone: null,
				taxIdentifier: null,
				timezone: "Asia/Kolkata",
			},
		});

		expect(request).toMatchObject({
			contractVersion: 1,
			templateId: "editorial-olive",
			payload: {
				source: { quotationId: "quotation-1", revision: 7 },
				quote: {
					quoteNumber: "QT-001",
					quoteVersion: 2,
					validUntil: "2026-09-30",
				},
				branding: { organizationName: "Studio Nisha", logoUrl: null },
				document,
			},
		});
	});

	it("accepts only a handoff URL on the configured Studio origin", async () => {
		const request = buildQuotationEditorHandoffRequest({
			quote: {
				id: "quotation-1",
				quoteNumber: "QT-001",
				version: 1,
				documentRevision: 1,
				document,
				expiresAt: null,
				createdAt: new Date("2026-09-03T04:00:00.000Z"),
			},
			branding: {
				organizationName: "Studio Nisha",
				address: null,
				email: null,
				phone: null,
				taxIdentifier: null,
				timezone: "Asia/Kolkata",
			},
		});
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			Response.json(
				{
					data: {
						editorUrl:
							"https://editor.example.com/composition-handoffs/token",
					},
				},
				{ status: 201 },
			),
		);

		await expect(
			createRemoteQuotationEditorHandoff({
				editorUrl: "https://editor.example.com",
				secret: "secret",
				request,
				fetcher,
			}),
		).resolves.toBe(
			"https://editor.example.com/composition-handoffs/token",
		);
		fetcher.mockResolvedValueOnce(
			Response.json({
				data: { editorUrl: "https://evil.example/steal" },
			}),
		);
		await expect(
			createRemoteQuotationEditorHandoff({
				editorUrl: "https://editor.example.com",
				secret: "secret",
				request,
				fetcher,
			}),
		).rejects.toThrow("untrusted editor link");
	});
});
