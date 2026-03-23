import { expect, test } from "@playwright/test";

test.describe("home mobile", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("home widgets stay within the mobile viewport", async ({ page }) => {
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

		await page.goto(`/app/${organizationSlug}/home`);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		await expect(
			page.getByRole("heading", {
				name: /Good (morning|afternoon|evening)/i,
			}),
		).toBeVisible();
		const quickstartHeading = page.getByRole("heading", {
			name: "Your quickstart guide",
		});
		if ((await quickstartHeading.count()) > 0) {
			await expect(quickstartHeading).toBeVisible();
		}
		await expect(page.getByText("Quicklinks")).toBeVisible();
		await expect(page.getByText("Stickies")).toBeVisible();
		await expect(page.getByText("Recents")).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Workspace" }),
		).toBeVisible();
		await expect(page.getByText("Studio")).toBeVisible();

		const hasHorizontalOverflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > window.innerWidth;
		});

		expect(hasHorizontalOverflow).toBe(false);
	});
});
