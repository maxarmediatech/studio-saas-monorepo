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

test.describe("booking detail instant navigation", () => {
	test.skip(
		!email || !password,
		"Requires staging admin credentials for an authenticated booking flow",
	);
	test.setTimeout(120_000);

	test("renders the shared booking shell before dynamic data", async ({
		page,
	}) => {
		await signIn(page);
		const organizationSlug = new URL(page.url()).pathname.split("/")[2];
		const bookingsPath = `/app/${organizationSlug}/bookings`;
		await page.goto(bookingsPath);

		const firstBookingLink = page
			.locator('table a[href*="/bookings/"]')
			.first();
		await firstBookingLink.waitFor({ state: "visible" });
		const firstHref = await firstBookingLink.getAttribute("href");
		if (!firstHref) {
			throw new Error("Expected the first booking link to have an href");
		}

		const shellPrefetch = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname.startsWith(
					`${bookingsPath}/`,
				) &&
				response.request().headers()["next-router-prefetch"] === "1",
			{ timeout: 20_000 },
		);
		await page.goto(firstHref);
		await page.getByRole("button", { name: "Toggle booking list" }).click();

		const siblingLink = page
			.locator(
				`aside a[href^="${bookingsPath}/"]:not([href="${firstHref}"])`,
			)
			.first();
		await siblingLink.waitFor({ state: "visible" });
		const siblingHref = await siblingLink.getAttribute("href");
		if (!siblingHref) {
			throw new Error("Expected a sibling booking link to have an href");
		}

		const prefetchResponse = await shellPrefetch;
		expect(prefetchResponse.ok()).toBe(true);

		await instant(page, async () => {
			await siblingLink.click();
			await page.waitForURL((url) => url.pathname === siblingHref);
			await expect(
				page.getByTestId("booking-detail-page-skeleton"),
			).toBeVisible();
		});
	});
});
