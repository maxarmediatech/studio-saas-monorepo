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

		test("legacy app aliases redirect before rendering", async ({
			request,
		}) => {
			const cases = [
				{
					path: "/app/test-org",
					location: "/app/test-org/home",
				},
				{
					path: "/app/test-org/crews?view=list",
					location: "/app/test-org/people?view=list",
				},
				{
					path: "/app/test-org/crews/crew_123",
					location: "/app/test-org/people/crew_123",
				},
				{
					path: "/app/test-org/configurations",
					location: "/app/test-org/configurations/booking-types",
				},
				{
					path: "/app/test-org/settings/members",
					location: "/app/test-org/settings/people?view=members",
				},
			];

			for (const testCase of cases) {
				const response = await request.get(testCase.path, {
					maxRedirects: 0,
				});

				expect(response.status()).toBe(307);
				expect(response.headers().location).toBe(testCase.location);
			}
		});
	}

	test("does not request shoots list on home when calendar is inactive", async ({
		page,
	}) => {
		const shootListRequests: string[] = [];

		page.on("request", (request) => {
			if (
				request.method() === "POST" &&
				request.url().includes("/api/rpc/shoots/list")
			) {
				shootListRequests.push(request.url());
			}
		});

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

		shootListRequests.length = 0;

		await page.goto(`/app/${organizationSlug}/home`);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		await page.waitForLoadState("networkidle");

		expect(shootListRequests).toEqual([]);
	});
});
