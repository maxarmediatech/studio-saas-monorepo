import { expect, test } from "@playwright/test";

test.describe("bookings mobile", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("renders the mobile bookings list without horizontal overflow", async ({
		page,
	}) => {
		await page.goto("/app");

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		const match = page.url().match(/\/app\/([^/]+)/);
		expect(
			match,
			`Unexpected /app redirect URL: ${page.url()}`,
		).not.toBeNull();
		const organizationSlug = match?.[1];
		expect(organizationSlug).toBeTruthy();

		await page.goto(`/app/${organizationSlug}/bookings`);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		await expect(
			page.getByRole("heading", { name: "Bookings" }),
		).toBeVisible();
		await expect(page.getByTestId("booking-mobile-list")).toBeVisible();
		await expect(page.locator("table")).toHaveCount(0);

		const hasCards =
			(await page.getByTestId("booking-mobile-card").count()) > 0;
		if (hasCards) {
			await expect(
				page.getByTestId("booking-mobile-card").first(),
			).toBeVisible();
		} else {
			await expect(page.getByText("No bookings found")).toBeVisible();
		}

		const hasHorizontalOverflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > window.innerWidth;
		});

		expect(hasHorizontalOverflow).toBe(false);
	});
});
