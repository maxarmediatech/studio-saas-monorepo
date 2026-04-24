import { expect, test } from "@playwright/test";

const AUTH_SHELL_MARKERS = [
	"rounded-3xl bg-card",
	"Privacy policy",
	"Terms and conditions",
	"stuwiz-logo-dark.png",
];

function expectAuthShellMarkers(html: string, mode: "present" | "absent") {
	for (const marker of AUTH_SHELL_MARKERS) {
		if (mode === "present") {
			expect(html).toContain(marker);
			continue;
		}

		expect(html).not.toContain(marker);
	}
}

test.describe("auth callback recovery", () => {
	test("auth complete redirects unauthenticated users to login with redirectTo", async ({
		page,
	}) => {
		const redirectTo = "/app/test-org/home?tab=recent&view=list";
		await page.goto(
			`/auth/complete?redirectTo=${encodeURIComponent(redirectTo)}`,
			{ waitUntil: "domcontentloaded" },
		);
		await page.waitForURL((url) => {
			return url.pathname === "/auth/login";
		});

		const currentUrl = new URL(page.url());
		expect(currentUrl.pathname).toBe("/auth/login");
		expect(currentUrl.searchParams.get("redirectTo")).toBe(redirectTo);
	});

	test("auth complete does not stream auth shell markup", async ({
		request,
	}) => {
		const response = await request.get("/auth/complete?redirectTo=%2Fapp");
		expect(response.ok()).toBe(true);

		const html = await response.text();
		expectAuthShellMarkers(html, "absent");
	});

	test("auth login still renders auth shell markup", async ({ request }) => {
		const response = await request.get("/auth/login");
		expect(response.ok()).toBe(true);

		const html = await response.text();
		expectAuthShellMarkers(html, "present");
	});

	test("auth login links to legal pages", async ({ page }) => {
		await page.goto("/auth/login", { waitUntil: "domcontentloaded" });

		await expect(
			page.getByRole("link", { name: "Privacy policy" }),
		).toHaveAttribute("href", "/legal/privacy-policy");
		await expect(
			page.getByRole("link", { name: "Terms and conditions" }),
		).toHaveAttribute("href", "/legal/terms");
	});

	test("legal pages render", async ({ request }) => {
		for (const path of ["/legal/privacy-policy", "/legal/terms"]) {
			const response = await request.get(path);

			expect(response.ok()).toBe(true);
		}
	});

	test("auth error page renders recovery actions", async ({ page }) => {
		await page.goto(
			`/auth/error?error=state_mismatch&redirectTo=${encodeURIComponent("/app")}`,
			{ waitUntil: "domcontentloaded" },
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
