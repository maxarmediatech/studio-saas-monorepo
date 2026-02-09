import { expect, test } from "@playwright/test";

type QuickstartLegacyState = {
	hide: boolean;
	createdBooking: boolean;
	visitedMembers: boolean;
	visitedSettings: boolean;
	visitedProfile: boolean;
};

const LEGACY_STATE: QuickstartLegacyState = {
	hide: false,
	createdBooking: true,
	visitedMembers: true,
	visitedSettings: true,
	visitedProfile: true,
};

test.describe("quickstart guide", () => {
	test("migrates legacy local state and shows source-of-truth steps", async ({
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

		const storageKey = `quickstart-guide-${organizationSlug}`;

		await page.evaluate(
			({ key, value }) => {
				window.localStorage.setItem(key, JSON.stringify(value));
			},
			{ key: storageKey, value: LEGACY_STATE },
		);

		await page.goto(`/app/${organizationSlug}/home`);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		await expect(
			page.getByRole("heading", { name: "Your quickstart guide" }),
		).toBeVisible();

		await expect(
			page.getByRole("heading", { name: "Create booking types" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Create package types" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Create a booking" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Invite your team" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Create relation types" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: "Make Studio yours" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: "Set up your workspace" }),
		).toHaveCount(0);

		await expect
			.poll(async () => {
				return page.evaluate((key) => {
					const value = window.localStorage.getItem(key);
					return value ? JSON.parse(value) : null;
				}, storageKey);
			})
			.toEqual({
				hide: false,
				version: 2,
			});

		const ctas = page.locator("a", {
			hasText:
				/Open booking types|Open package types|Create booking|Finish setup first|Invite team/,
		});

		if ((await ctas.count()) > 0) {
			await ctas.first().click();
			await page.waitForTimeout(100);
			await page.goto(`/app/${organizationSlug}/home`);

			await expect
				.poll(async () => {
					return page.evaluate((key) => {
						const value = window.localStorage.getItem(key);
						return value ? JSON.parse(value) : null;
					}, storageKey);
				})
				.toEqual({
					hide: false,
					version: 2,
				});
		}
	});
});
