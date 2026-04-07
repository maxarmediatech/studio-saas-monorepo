import { afterEach, describe, expect, it, vi } from "vitest";
import { markCloudApiMessagesRead } from "./cloud-api-admin";

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
