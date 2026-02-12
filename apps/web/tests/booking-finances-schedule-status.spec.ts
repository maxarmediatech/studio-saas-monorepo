import { expect, test } from "@playwright/test";

type ScheduleCandidate = {
	amount: string;
	bookingId: string;
	status: string;
};

test.describe("booking finances schedule status", () => {
	test("matches schedule status with scheduled-payments table", async ({
		page,
	}) => {
		await page.goto("/app");

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		const slugMatch = page.url().match(/\/app\/([^/]+)/);
		expect(
			slugMatch,
			`Unexpected /app redirect URL: ${page.url()}`,
		).not.toBeNull();
		const organizationSlug = slugMatch?.[1];
		expect(organizationSlug).toBeTruthy();

		await page.goto(`/app/${organizationSlug}/scheduled-payments`);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		const candidate = await page.evaluate<ScheduleCandidate | null>(() => {
			const targetStatuses = new Set([
				"Partial",
				"Completed",
				"Overdue",
				"Cancelled",
			]);

			for (const row of document.querySelectorAll("tbody tr")) {
				const cells = Array.from(row.querySelectorAll("td"));
				if (cells.length < 7) {
					continue;
				}

				const bookingHref =
					row
						.querySelector<HTMLAnchorElement>(
							'a[href*="/bookings/"]',
						)
						?.getAttribute("href") ?? "";
				const bookingMatch = bookingHref.match(/\/bookings\/([^/?#]+)/);
				const bookingId = bookingMatch?.[1];
				if (!bookingId) {
					continue;
				}

				const statusText =
					cells.at(-2)?.textContent?.replace(/\s+/g, " ").trim() ??
					"";
				if (!targetStatuses.has(statusText)) {
					continue;
				}

				const amountText =
					cells[4]?.textContent?.replace(/\s+/g, " ").trim() ?? "";
				if (!amountText) {
					continue;
				}

				return {
					amount: amountText,
					bookingId,
					status: statusText,
				};
			}

			return null;
		});

		if (!candidate) {
			test.skip(
				true,
				"Requires at least one non-pending scheduled payment row in the table",
			);
			return;
		}

		await page.goto(
			`/app/${organizationSlug}/bookings/${candidate.bookingId}`,
		);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		await expect(
			page.getByText(/Scheduled Payments/i).first(),
		).toBeVisible();

		const financesTable = page
			.locator("div.border-t.border-border table")
			.first();
		const matchingRow = financesTable
			.locator("tr")
			.filter({ hasText: candidate.amount })
			.filter({ hasText: candidate.status })
			.filter({ hasText: "Due" })
			.first();

		await expect(matchingRow).toBeVisible();
	});
});
