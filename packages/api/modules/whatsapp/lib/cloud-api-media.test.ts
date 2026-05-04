import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { putObjectMock } = vi.hoisted(() => ({
	putObjectMock: vi.fn(),
}));

vi.mock("@repo/env", () => ({
	getUploadsBucketName: () => "uploads",
}));

vi.mock("@repo/storage", () => ({
	putObject: putObjectMock,
}));

import { parseCloudApiWebhook } from "@repo/whatsapp-core";
import { ingestCloudApiMediaAsset } from "../../../../../services/whatsapp-worker/src/cloud-api-media";

describe("parseCloudApiWebhook media parsing", () => {
	it("captures document file name and mime type", () => {
		const [event] = parseCloudApiWebhook({
			entry: [
				{
					changes: [
						{
							value: {
								metadata: {
									phone_number_id: "phone_123",
								},
								messages: [
									{
										id: "wamid.1",
										from: "919999999999",
										timestamp: "1710000000",
										type: "document",
										document: {
											id: "media_123",
											filename: "call sheet.pdf",
											mime_type: "application/pdf",
										},
									},
								],
							},
						},
					],
				},
			],
		});

		expect(event).toMatchObject({
			type: "message.inbound",
			messageType: "document",
			content: {
				fileName: "call sheet.pdf",
				mediaId: "media_123",
				mimeType: "application/pdf",
			},
		});
	});
});

describe("ingestInboundCloudApiMedia", () => {
	beforeEach(() => {
		putObjectMock.mockReset();
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("downloads media bytes and stores them in uploads", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						file_size: 3,
						mime_type: "image/jpeg",
						url: "https://graph.facebook.com/media-download",
					}),
					{
						status: 200,
						headers: {
							"Content-Type": "application/json",
						},
					},
				),
			)
			.mockResolvedValueOnce(
				new Response(new Uint8Array([1, 2, 3]), {
					status: 200,
					headers: {
						"Content-Length": "3",
						"Content-Type": "image/jpeg",
					},
				}),
			);

		vi.stubGlobal("fetch", fetchMock);

		const result = await ingestCloudApiMediaAsset({
			accessToken: "plain-token",
			accountId: "account_123",
			apiVersion: "v22.0",
			mediaId: "media_123",
			messageType: "image",
			organizationId: "org_123",
		});

		expect(result).toMatchObject({
			fileName: "image-media_123.jpg",
			fileSize: 3,
			mimeType: "image/jpeg",
			providerMediaId: "media_123",
			storageType: "s3",
		});
		expect(result.storageUrl).toContain(
			"orgs/org_123/whatsapp/inbound/account_123/",
		);
		expect(putObjectMock).toHaveBeenCalledWith(
			expect.stringContaining(
				"orgs/org_123/whatsapp/inbound/account_123/",
			),
			expect.objectContaining({
				bucket: "uploads",
				contentLength: 3,
				contentType: "image/jpeg",
			}),
		);
	});
});
