import { instant } from "@next/playwright";
import { expect, type Page, test } from "@playwright/test";

const email = process.env.STAGING_ADMIN_EMAIL;
const password = process.env.STAGING_ADMIN_PASSWORD;

async function signIn(page: Page) {
	await page.goto("/auth/login");
	await page.getByLabel("Email").fill(email ?? "");
	await page.locator('input[type="password"]').fill(password ?? "");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await page.waitForURL((url) => url.pathname.startsWith("/app/"));
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("home instant navigation", () => {
	test.skip(
		!email || !password,
		"Requires staging admin credentials for an authenticated Home flow",
	);
	test.setTimeout(120_000);

	test("renders Home from the hydrated session without a server blocker", async ({
		page,
	}) => {
		const consoleErrors: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "error") {
				consoleErrors.push(message.text());
			}
		});

		await signIn(page);
		const organizationSlug = new URL(page.url()).pathname.split("/")[2];
		const homePath = `/app/${organizationSlug}/home`;
		const sessionResponse = await page.request.get(
			"/api/auth/get-session?disableCookieCache=true",
		);
		const session = (await sessionResponse.json()) as {
			user?: { name?: string };
		};
		const firstName = session.user?.name?.split(" ")[0];
		if (!firstName) {
			throw new Error(
				"Expected the authenticated session to include a name",
			);
		}

		const homePrefetch = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === homePath &&
				response.request().headers()["next-router-prefetch"] === "1",
			{ timeout: 20_000 },
		);
		await page.goto(`/app/${organizationSlug}/dashboard`);

		const homeLink = page.getByRole("link", {
			name: "Home",
			exact: true,
		});
		await homeLink.waitFor({ state: "visible" });
		const prefetchResponse = await homePrefetch;
		expect(prefetchResponse.ok()).toBe(true);

		await instant(page, async () => {
			await homeLink.click();
			await page.waitForURL((url) => url.pathname === homePath);
			await expect(
				page.getByRole("heading", { name: "Home", exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("heading", {
					name: new RegExp(
						`^Good (morning|afternoon|evening), ${escapeRegExp(firstName)}$`,
					),
				}),
			).toBeVisible();
		});

		expect(consoleErrors).toEqual([]);
	});
});
