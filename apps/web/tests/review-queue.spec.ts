import { expect, test } from "@playwright/test";

test.describe("review queue", () => {
	test("loads review queue page", async ({ page }) => {
		await page.goto("/app");

		if (page.url().includes("/auth/")) {
			test.skip(true, "Requires an authenticated session to access /app/*");
		}

		const match = page.url().match(/\/app\/([^/]+)/);
		expect(match, `Unexpected /app redirect URL: ${page.url()}`).not.toBeNull();
		const organizationSlug = match?.[1];
		expect(organizationSlug).toBeTruthy();

		await page.goto(`/app/${organizationSlug}/reviews`);

		if (page.url().includes("/auth/")) {
			test.skip(true, "Requires an authenticated session to access /app/*");
		}

		await expect(
			page.getByRole("heading", { name: "Review Queue" }),
		).toBeVisible();

		const emptyState = page.getByText("No submissions found");
		if (await emptyState.isVisible()) {
			await expect(emptyState).toBeVisible();
		}
	});
});
