import { expect, test } from "@playwright/test";

test.describe("dashboard financial tab", () => {
	test("loads financial tab", async ({ page }) => {
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

		await page.goto(`/app/${organizationSlug}/dashboard?tab=financial`);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		await expect(
			page.getByRole("tab", { name: "Financial" }),
		).toBeVisible();

		const revenueCard = page.getByText("Revenue");
		const collectedCard = page.getByText("Collected");
		const expensesCard = page.getByText("Expenses");
		const netProfitCard = page.getByText("Net Profit");

		await expect(revenueCard.first()).toBeVisible();
		await expect(collectedCard.first()).toBeVisible();
		await expect(expensesCard.first()).toBeVisible();
		await expect(netProfitCard.first()).toBeVisible();

		const categoryChart = page.getByRole("heading", {
			name: "Expenses by Category",
		});
		const splitChart = page.getByRole("heading", {
			name: "Expense Split (Studio vs Client)",
		});
		const recentExpenses = page.getByRole("heading", {
			name: "Recent Expenses",
		});

		await expect(categoryChart).toBeVisible();
		await expect(splitChart).toBeVisible();
		await expect(recentExpenses).toBeVisible();
	});
});
