import { instant } from "@next/playwright";
import { expect, type Page, test } from "@playwright/test";

const email = process.env.STAGING_ADMIN_EMAIL;
const password = process.env.STAGING_ADMIN_PASSWORD;

async function signIn(page: Page) {
	await page.goto("/auth/login");
	await page.getByLabel("Email").fill(email ?? "");
	await page.locator('input[type="password"]').fill(password ?? "");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await page.waitForURL((url) => url.pathname.startsWith("/app/"));
}

const destinations = [
	{ label: "Bookings", segment: "bookings" },
	{ label: "Shoots", segment: "shoots" },
	{ label: "Deliverables", segment: "deliverables" },
	{ label: "Tasks", segment: "tasks" },
	{ label: "Clients", segment: "clients" },
	{ label: "Expenses", segment: "expenses" },
	{ label: "Payments", segment: "payments" },
] as const;

test.describe("studio module instant navigation", () => {
	test.skip(
		!email || !password,
		"Requires staging admin credentials for authenticated navigation",
	);
	test.setTimeout(180_000);

	test("every module exposes meaningful content on the click frame", async ({
		page,
	}) => {
		const consoleErrors: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "error") {
				consoleErrors.push(message.text());
			}
		});

		await signIn(page);
		const organizationSlug = new URL(page.url()).pathname.split("/")[2];

		for (const destination of destinations) {
			const path = `/app/${organizationSlug}/${destination.segment}`;
			const link = page.locator(`a[href="${path}"]:visible`).first();
			await link.waitFor({ state: "visible" });

			await instant(page, async () => {
				await link.click();
				await page.waitForURL((url) => url.pathname === path);
				await expect(
					page.getByRole("heading", {
						name: destination.label,
						exact: true,
					}),
				).toBeVisible();

				const resolvedContent = page.locator(
					`[data-route-content="${destination.segment}"]`,
				);
				const loadingContent = page.getByRole("status", {
					name: `Loading ${destination.segment}`,
				});
				await expect(resolvedContent.or(loadingContent)).toBeVisible();
			});

			await expect(
				page.locator(
					`[data-route-content="${destination.segment}"]`,
				),
			).toBeVisible();
		}

		expect(consoleErrors).toEqual([]);
	});
});
