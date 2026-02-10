import { expect, test } from "@playwright/test";

test.describe("booking wizard sidebar shoot sync", () => {
	test("sidebar jump to payments reflects shoot deletion immediately", async ({
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

		const bookingDraft = {
			state: {
				formData: {
					name: "Test Booking",
					bookingType: "test_booking_type",
					packageType: "test_package_type",
					packageCost: "99999.00",
					note: "",
					contractAttachment: null,
					participants: [
						{
							clientId: "00000000-0000-0000-0000-000000000000",
							role: "test_role",
						},
					],
					shoots: [
						{
							shootType: "wedding",
							shootDate: "2026-02-13",
							startTime: "00:22",
							location: "",
							notes: "",
							crewAssignments: [],
						},
						{
							shootType: "reception",
							shootDate: "2026-02-11",
							startTime: "",
							location: "",
							notes: "",
							crewAssignments: [],
						},
					],
					payments: [],
					paymentSchedules: [],
					deliverables: [],
				},
				completedSteps: ["details", "shoots"],
				_lastSavedAt: null,
			},
			version: 1,
		};

		await page.evaluate((draft) => {
			localStorage.setItem("booking-form-draft", JSON.stringify(draft));
		}, bookingDraft);

		await page.goto(`/app/${organizationSlug}/bookings/new/shoots`);
		await expect(page).toHaveURL(
			new RegExp(`/app/${organizationSlug}/bookings/new/shoots$`),
		);

		const removeShootButtons = page.getByRole("button", {
			name: "Remove shoot",
		});
		await expect(removeShootButtons).toHaveCount(2);
		await removeShootButtons.nth(1).click();

		const stepperNav = page.locator("nav[aria-label='Booking form steps']");
		await stepperNav
			.getByRole("button", { name: /Payments/i })
			.first()
			.click();

		await expect(page).toHaveURL(
			new RegExp(`/app/${organizationSlug}/bookings/new/payments$`),
		);
		await expect(page.getByText(/Wedding\s*•/)).toBeVisible();
		await expect(page.getByText(/Reception\s*•/)).toHaveCount(0);
	});
});
