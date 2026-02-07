import { expect, test } from "@playwright/test";
import { config } from "@repo/config";

test.describe("social auth redirect", () => {
	test.skip(
		!(config.auth.enableSignup && config.auth.enableSocialLogin),
		"Social signup/login disabled in config",
	);

	test("should preserve redirectTo in social callback URL", async ({
		page,
	}) => {
		const redirectTo = "/app/test-org/home?tab=recent&view=list";
		await page.goto(
			`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`,
		);

		const socialRequestPromise = page.waitForRequest((request) => {
			return (
				request.url().includes("/api/auth/") &&
				request.url().includes("social")
			);
		});

		await page
			.getByRole("button", { name: /sign in with google/i })
			.click();

		const socialRequest = await socialRequestPromise;
		const url = new URL(socialRequest.url());

		const callbackURLFromQuery = url.searchParams.get("callbackURL");
		const callbackURLFromBody = (() => {
			try {
				const data = socialRequest.postDataJSON() as {
					callbackURL?: string;
				} | null;
				return data?.callbackURL ?? null;
			} catch {
				return null;
			}
		})();

		expect(callbackURLFromQuery ?? callbackURLFromBody).toBe(
			`http://localhost:3000${redirectTo}`,
		);
	});

	test("should ignore external redirectTo in social callback URL", async ({
		page,
	}) => {
		await page.goto(
			`/auth/login?redirectTo=${encodeURIComponent("https://evil.example/phish")}`,
		);

		const socialRequestPromise = page.waitForRequest((request) => {
			return (
				request.url().includes("/api/auth/") &&
				request.url().includes("social")
			);
		});

		await page
			.getByRole("button", { name: /sign in with google/i })
			.click();

		const socialRequest = await socialRequestPromise;
		const url = new URL(socialRequest.url());

		const callbackURLFromQuery = url.searchParams.get("callbackURL");
		const callbackURLFromBody = (() => {
			try {
				const data = socialRequest.postDataJSON() as {
					callbackURL?: string;
				} | null;
				return data?.callbackURL ?? null;
			} catch {
				return null;
			}
		})();

		expect(callbackURLFromQuery ?? callbackURLFromBody).toBe(
			"http://localhost:3000/app",
		);
	});
});
