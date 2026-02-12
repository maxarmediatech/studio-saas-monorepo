import { expect, test } from "@playwright/test";

type BookingCandidate = {
	id: string;
	name: string;
	referenceNumber: string;
};

test.describe("booking context booking id", () => {
	test("prefers route bookingId over stale query bookingId for create task sheet", async ({
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

		await page.goto(`/app/${organizationSlug}/bookings`);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		const candidates = await page.evaluate<BookingCandidate[]>(() => {
			const seen = new Set<string>();
			const links = Array.from(
				document.querySelectorAll<HTMLAnchorElement>(
					'a[href*="/bookings/"]',
				),
			);

			return links
				.map((link) => {
					const href = link.getAttribute("href") ?? "";
					const match = href.match(/\/bookings\/([^/?#]+)/);
					const id = match?.[1];
					if (!id || id === "new" || seen.has(id)) {
						return null;
					}

					const row = link.closest("tr");
					const name = link.textContent?.trim() ?? "";
					const referenceNumber =
						row
							?.querySelector("span.font-mono")
							?.textContent?.trim() ?? "";

					if (!name || !referenceNumber) {
						return null;
					}

					seen.add(id);
					return { id, name, referenceNumber };
				})
				.filter(
					(candidate): candidate is BookingCandidate =>
						candidate !== null,
				);
		});

		if (candidates.length < 2) {
			test.skip(
				true,
				"Requires at least two visible bookings with name and reference number",
			);
		}

		const routeBooking = candidates[0];
		const queryBooking = candidates[1];

		await page.goto(
			`/app/${organizationSlug}/bookings/${routeBooking.id}?bookingId=${queryBooking.id}&createTask=true`,
		);

		if (page.url().includes("/auth/")) {
			test.skip(
				true,
				"Requires an authenticated session to access /app/*",
			);
		}

		await expect(
			page.getByRole("heading", { name: "Add Task" }),
		).toBeVisible();

		const bookingCombobox = page.locator(
			'button#bookingId[role="combobox"]',
		);
		await expect(bookingCombobox).toBeVisible();
		await expect(bookingCombobox).toContainText(
			routeBooking.referenceNumber,
		);
		await expect(bookingCombobox).not.toContainText(
			queryBooking.referenceNumber,
		);
	});
});
