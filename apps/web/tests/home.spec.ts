import { expect, test } from "@playwright/test";
import { config } from "@repo/config";

test.describe("home page", () => {
	if (config.ui.marketing.enabled) {
		test("should load", async ({ page }) => {
			await page.goto("/");

			await expect(
				page.getByRole("heading", {
					name: "Your revolutionary Next.js SaaS",
				}),
			).toBeVisible();
		});
	} else {
		test("should be redirected to app", async ({ page }) => {
			await page.goto("/");

			await expect(page).toHaveURL(/\.*\/auth\/login/);
		});

		test("should preserve protected route query in auth redirect", async ({
			page,
		}) => {
			await page.goto("/app/test-org/home?tab=recent&view=list");

			const currentUrl = new URL(page.url());
			expect(currentUrl.pathname).toBe("/auth/login");
			expect(currentUrl.searchParams.get("redirectTo")).toBe(
				"/app/test-org/home?tab=recent&view=list",
			);
		});
	}
});
