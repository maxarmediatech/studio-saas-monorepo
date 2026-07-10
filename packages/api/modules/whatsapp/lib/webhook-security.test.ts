import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./webhook-security";

describe("verifyWebhookSignature", () => {
	it("accepts a valid Meta-style sha256 signature", () => {
		const body = JSON.stringify({ hello: "world" });
		const secret = "super-secret";
		const signature = crypto
			.createHmac("sha256", secret)
			.update(body)
			.digest("hex");

		expect(
			verifyWebhookSignature(body, `sha256=${signature}`, secret),
		).toBe(true);
	});

	it("rejects malformed or mismatched signatures", () => {
		expect(
			verifyWebhookSignature('{"x":1}', "sha256=deadbeef", "secret"),
		).toBe(false);
		expect(verifyWebhookSignature('{"x":1}', "deadbeef", "secret")).toBe(
			false,
		);
	});
});
