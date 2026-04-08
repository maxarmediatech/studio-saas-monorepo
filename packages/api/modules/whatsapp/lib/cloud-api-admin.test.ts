import { afterEach, describe, expect, it, vi } from "vitest";
import {
	listCloudApiTemplates,
	markCloudApiMessagesRead,
} from "./cloud-api-admin";

describe("markCloudApiMessagesRead", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("succeeds when Meta accepts all read receipts", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: true }),
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			markCloudApiMessagesRead({
				accessToken: "token",
				phoneNumberId: "123",
				messageIds: ["wamid-1", "wamid-2"],
			}),
		).resolves.toBeUndefined();

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("throws when Meta rejects a read receipt", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			json: async () => ({
				error: {
					message: "Meta rejected the read receipt",
				},
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			markCloudApiMessagesRead({
				accessToken: "token",
				phoneNumberId: "123",
				messageIds: ["wamid-1"],
			}),
		).rejects.toThrow("Meta rejected the read receipt");
	});
});

describe("listCloudApiTemplates", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("collects templates across Graph pagination", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [
						{
							id: "tpl_1",
							name: "booking_reminder",
							language: "en",
							status: "APPROVED",
							category: "UTILITY",
							components: [{ type: "BODY", text: "Hi {{1}}" }],
						},
					],
					paging: {
						cursors: {
							after: "cursor-1",
						},
					},
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [
						{
							id: "tpl_2",
							name: "crew_update",
							language: "en",
							status: "APPROVED",
							category: "UTILITY",
							components: [{ type: "BODY", text: "Crew {{1}}" }],
						},
					],
				}),
			});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			listCloudApiTemplates({
				accessToken: "token",
				wabaId: "waba_123",
			}),
		).resolves.toEqual({
			apiVersion: "v22.0",
			templates: [
				{
					providerTemplateId: "tpl_1",
					name: "booking_reminder",
					language: "en",
					status: "APPROVED",
					category: "UTILITY",
					components: [{ type: "BODY", text: "Hi {{1}}" }],
					rejectedReason: null,
				},
				{
					providerTemplateId: "tpl_2",
					name: "crew_update",
					language: "en",
					status: "APPROVED",
					category: "UTILITY",
					components: [{ type: "BODY", text: "Crew {{1}}" }],
					rejectedReason: null,
				},
			],
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
