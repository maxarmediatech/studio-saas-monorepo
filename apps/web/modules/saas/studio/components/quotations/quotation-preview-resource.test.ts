import { describe, expect, it, vi } from "vitest";
import {
	fetchQuotationPdfBlob,
	shouldAcceptQuotationPreviewResponse,
} from "./quotation-preview-resource";

describe("quotation preview resource loading", () => {
	it("rejects an HTTP error before an iframe swap", async () => {
		const request = vi.fn().mockResolvedValue(
			new Response("Preview presentation is no longer current", {
				status: 409,
				headers: { "content-type": "text/plain" },
			}),
		);
		const controller = new AbortController();

		await expect(
			fetchQuotationPdfBlob(
				"/api/studio/quotations/q1/pdf?revision=1",
				controller.signal,
				request,
			),
		).rejects.toThrow("HTTP 409");
		expect(request).toHaveBeenCalledWith(
			"/api/studio/quotations/q1/pdf?revision=1",
			expect.objectContaining({
				cache: "no-store",
				credentials: "same-origin",
				signal: controller.signal,
			}),
		);
	});

	it("accepts only a successful PDF response", async () => {
		const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
		const response = new Response(bytes, {
			status: 200,
			headers: { "content-type": "application/pdf" },
		});
		const blob = await fetchQuotationPdfBlob(
			"/preview.pdf",
			new AbortController().signal,
			vi.fn().mockResolvedValue(response),
		);
		expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
	});

	it("rejects stale and aborted responses", () => {
		expect(
			shouldAcceptQuotationPreviewResponse("/old.pdf", "/new.pdf", false),
		).toBe(false);
		expect(
			shouldAcceptQuotationPreviewResponse("/new.pdf", "/new.pdf", true),
		).toBe(false);
		expect(
			shouldAcceptQuotationPreviewResponse("/new.pdf", "/new.pdf", false),
		).toBe(true);
	});
});
