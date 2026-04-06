import { getPublicAssetBaseUrl, toRequestAppUrl } from "@repo/utils";
import { afterEach, describe, expect, it } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("toRequestAppUrl", () => {
	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
	});

	it("prefers the localhost request origin for auth links", () => {
		process.env.NEXT_PUBLIC_SITE_URL = "https://app.stuwiz.com";
		process.env.EMAIL_BASE_URL = "https://app.stuwiz.com";
		process.env.EMAIL_ASSET_BASE_URL = "https://app.stuwiz.com";

		const request = new Request(
			"http://localhost:3000/api/auth/organization/create-invitation",
		);

		expect(
			toRequestAppUrl(
				"https://app.stuwiz.com/auth/signup?invitationId=inv_123&email=test%40example.com",
				request,
			),
		).toBe(
			"http://localhost:3000/auth/signup?invitationId=inv_123&email=test%40example.com",
		);
		expect(getPublicAssetBaseUrl({ allowLocalhost: false })).toBe(
			"https://app.stuwiz.com/",
		);
	});

	it("ignores forwarded host headers and uses the actual request origin", () => {
		process.env.NEXT_PUBLIC_SITE_URL = "https://app.stuwiz.com";

		const request = new Request(
			"https://preview.stuwiz.com/api/auth/magic-link",
			{
				headers: new Headers({
					"x-forwarded-host": "evil.example, preview.stuwiz.com",
					"x-forwarded-proto": "https",
				}),
			},
		);

		expect(
			toRequestAppUrl(
				"https://app.stuwiz.com/auth/login?token=test",
				request,
			),
		).toBe("https://preview.stuwiz.com/auth/login?token=test");
	});

	it("keeps localhost links even when forwarded host headers are poisoned", () => {
		process.env.NEXT_PUBLIC_SITE_URL = "https://app.stuwiz.com";

		const request = new Request(
			"http://localhost:3000/api/auth/magic-link",
			{
				headers: new Headers({
					"x-forwarded-host": "evil.example, preview.stuwiz.com",
					"x-forwarded-proto": "https",
				}),
			},
		);

		expect(
			toRequestAppUrl(
				"https://app.stuwiz.com/auth/login?token=test",
				request,
			),
		).toBe("http://localhost:3000/auth/login?token=test");
	});

	it("falls back to the configured app URL when request context is unavailable", () => {
		process.env.NEXT_PUBLIC_SITE_URL = "https://app.stuwiz.com";

		expect(toRequestAppUrl("/auth/signup?invitationId=inv_123")).toBe(
			"https://app.stuwiz.com/auth/signup?invitationId=inv_123",
		);
	});
});
