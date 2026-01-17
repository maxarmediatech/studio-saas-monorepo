import { expect, test } from "@playwright/test";

test.describe("booking wizard reset", () => {
	test("reset from review clears stale UI and draft", async ({ page }) => {
		await page.goto("/app");

		if (page.url().includes("/auth/")) {
			test.skip(true, "Requires an authenticated session to access /app/*");
		}

		const match = page.url().match(/\/app\/([^/]+)/);
		expect(match, `Unexpected /app redirect URL: ${page.url()}`).not.toBeNull();
		const organizationSlug = match?.[1];
		expect(organizationSlug).toBeTruthy();

		const bookingDraft = {
			state: {
				formData: {
					name: "Test Booking",
					bookingType: "test_booking_type",
					packageType: "test_package_type",
					packageCost: "100.00",
					note: "test note",
					contractAttachment: null,
					participants: [
						{
							clientId: "00000000-0000-0000-0000-000000000000",
							role: "test_role",
						},
					],
					shoots: [],
					payments: [],
					paymentSchedules: [],
					deliverables: [],
				},
				completedSteps: [
					"details",
					"shoots",
					"payments",
					"deliverables",
				],
				_lastSavedAt: null,
			},
			version: 1,
		};

		await page.evaluate((draft) => {
			localStorage.setItem("booking-form-draft", JSON.stringify(draft));
		}, bookingDraft);

		await page.goto(`/app/${organizationSlug}/bookings/new/review`);
		await expect(page).toHaveURL(
			new RegExp(`/app/${organizationSlug}/bookings/new/review$`),
		);

		await page.getByRole("button", { name: "Reset" }).click();
		const dialog = page.getByRole("alertdialog");
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Reset" }).click();

		await expect(page).toHaveURL(
			new RegExp(`/app/${organizationSlug}/bookings/new/details$`),
		);

		await expect(page.locator("input#name")).toHaveValue("");
		await expect(page.locator("button#bookingType")).toContainText(
			"Select type...",
		);

		const persisted = await page.evaluate(() => {
			const raw = localStorage.getItem("booking-form-draft");
			return raw ? (JSON.parse(raw) as unknown) : null;
		});

		expect(persisted).toBeTruthy();
		expect(persisted).toMatchObject({
			state: {
				formData: {
					name: "",
					bookingType: "",
					packageType: "",
				},
				completedSteps: [],
			},
			version: 1,
		});
	});
});
