import { expect, type Page, test } from "@playwright/test";
import { config } from "@repo/config";

async function expectSocialSectionOrder(page: Page) {
	const isValidOrder = await page.evaluate(() => {
		const googleButton = Array.from(
			document.querySelectorAll("button"),
		).find((button) =>
			/sign in with google/i.test(button.textContent ?? ""),
		);
		const continueWith = Array.from(document.querySelectorAll("p")).find(
			(p) => /continue with/i.test(p.textContent ?? ""),
		);
		const emailInput = document.querySelector(
			'input[autocomplete="email"]',
		);

		if (!googleButton || !continueWith || !emailInput) {
			return null;
		}

		const googleBeforeDivider = Boolean(
			googleButton.compareDocumentPosition(continueWith) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		);
		const dividerBeforeEmail = Boolean(
			continueWith.compareDocumentPosition(emailInput) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		);
		const googleBeforeEmail = Boolean(
			googleButton.compareDocumentPosition(emailInput) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		);

		return googleBeforeDivider && dividerBeforeEmail && googleBeforeEmail;
	});

	expect(isValidOrder).toBe(true);
}

test.describe("social auth redirect", () => {
	test.skip(
		!(config.auth.enableSignup && config.auth.enableSocialLogin),
		"Social signup/login disabled in config",
	);

	test("should render google sign-in above email input on login", async ({
		page,
	}) => {
		await page.goto("/auth/login");
		await expectSocialSectionOrder(page);
	});

	test("should render google sign-in above email input on signup", async ({
		page,
	}) => {
		await page.goto("/auth/signup");
		await expectSocialSectionOrder(page);
	});

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
