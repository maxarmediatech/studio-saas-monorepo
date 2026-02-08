import { expect, test } from "@playwright/test";

test.describe("auth callback recovery", () => {
	test("auth complete redirects unauthenticated users to login with redirectTo", async ({
		page,
	}) => {
		const redirectTo = "/app/test-org/home?tab=recent&view=list";
		await page.goto(
			`/auth/complete?redirectTo=${encodeURIComponent(redirectTo)}`,
		);

		const currentUrl = new URL(page.url());
		expect(currentUrl.pathname).toBe("/auth/login");
		expect(currentUrl.searchParams.get("redirectTo")).toBe(redirectTo);
	});

	test("auth error page renders recovery actions", async ({ page }) => {
		await page.goto(
			`/auth/error?error=state_mismatch&redirectTo=${encodeURIComponent("/app")}`,
		);

		await expect(page.getByText("Sign in interrupted")).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Try again" }),
		).toHaveAttribute("href", "/auth/login?redirectTo=%2Fapp");
		await expect(
			page.getByRole("link", { name: "Create account" }),
		).toHaveAttribute("href", "/auth/signup");
	});
});
