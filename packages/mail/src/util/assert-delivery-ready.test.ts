import { afterEach, describe, expect, it } from "vitest";
import { assertTransactionalEmailDeliveryReady } from "./assert-delivery-ready";

const ORIGINAL_ENV = { ...process.env };

describe("assertTransactionalEmailDeliveryReady", () => {
	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
	});

	it("accepts public Stuwiz email URLs with a configured provider key", () => {
		process.env.RESEND_API_KEY = "re_test";
		process.env.EMAIL_BASE_URL = "https://app.stuwiz.com";
		process.env.EMAIL_ASSET_BASE_URL = "https://app.stuwiz.com";

		expect(() => assertTransactionalEmailDeliveryReady()).not.toThrow();
	});

	it("rejects missing resend credentials", () => {
		delete process.env.RESEND_API_KEY;
		process.env.EMAIL_BASE_URL = "https://app.stuwiz.com";
		process.env.EMAIL_ASSET_BASE_URL = "https://app.stuwiz.com";

		expect(() => assertTransactionalEmailDeliveryReady()).toThrow(
			"RESEND_API_KEY is missing.",
		);
	});

	it("rejects localhost email URLs", () => {
		process.env.RESEND_API_KEY = "re_test";
		process.env.EMAIL_BASE_URL = "http://localhost:3000";
		process.env.EMAIL_ASSET_BASE_URL = "http://localhost:3000";

		expect(() => assertTransactionalEmailDeliveryReady()).toThrow(
			"Email app URLs must be public. Set EMAIL_BASE_URL to your public Stuwiz domain instead of localhost.",
		);
	});

	it.each([
		"http://192.168.1.20:3000",
		"http://10.0.0.5:3000",
		"http://host.docker.internal:3000",
		"http://studio.local:3000",
		"http://web:3000",
		"http://app.internal:3000",
	])("rejects private network email URL %s", (url) => {
		process.env.RESEND_API_KEY = "re_test";
		process.env.EMAIL_BASE_URL = url;
		process.env.EMAIL_ASSET_BASE_URL = url;

		expect(() => assertTransactionalEmailDeliveryReady()).toThrow(
			"Email app URLs must be public. Set EMAIL_BASE_URL to your public Stuwiz domain instead of a private network host.",
		);
	});
});
