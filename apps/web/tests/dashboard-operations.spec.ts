import { expect, test } from "@playwright/test";

test.describe("dashboard operations tab", () => {
	test("loads operations tab", async ({ page }) => {
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

		await page.goto(`/app/${organizationSlug}/dashboard?tab=operations`);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		await expect(
			page.getByRole("tab", { name: "Operations" }),
		).toBeVisible();

		const shootsPanel = page.getByRole("heading", {
			name: "Upcoming Shoots",
		});
		const tasksPanel = page.getByRole("heading", { name: "Pending Tasks" });
		const deliverablesPanel = page.getByRole("heading", {
			name: "Pending Deliverables",
		});

		await expect(shootsPanel).toBeVisible();
		await expect(tasksPanel).toBeVisible();
		await expect(deliverablesPanel).toBeVisible();
	});
});
