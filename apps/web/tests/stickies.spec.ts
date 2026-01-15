import { expect, test } from "@playwright/test";

test.describe("stickies", () => {
	test("typing does not reset after autosave", async ({ page }) => {
		await page.goto("/app");

		if (page.url().includes("/auth/")) {
			test.skip(true, "Requires an authenticated session to access /app/*");
		}

		const match = page.url().match(/\/app\/([^/]+)/);
		expect(match, `Unexpected /app redirect URL: ${page.url()}`).not.toBeNull();
		const organizationSlug = match?.[1];
		expect(organizationSlug).toBeTruthy();

		await page.goto(`/app/${organizationSlug}/home`);

		if (page.url().includes("/auth/")) {
			test.skip(true, "Requires an authenticated session to access /app/*");
		}

		const addStickyButton = page.getByRole("button", { name: "Add sticky" });
		await expect(addStickyButton).toBeVisible();
		await addStickyButton.click();

		const content = `E2E sticky ${Date.now()}`;
		const draftTextarea = page.getByPlaceholder("Click to type here...");
		await expect(draftTextarea).toBeVisible();
		await draftTextarea.fill(content);

		await page.getByText("Stickies").click();

		const savedTextarea = page.getByDisplayValue(content);
		await expect(savedTextarea).toBeVisible();

		await savedTextarea.click();
		await expect(savedTextarea).toBeFocused();
		await savedTextarea.type(" updated");
		await page.waitForTimeout(700);

		await expect(savedTextarea).toBeFocused();
		await expect(savedTextarea).toHaveValue(`${content} updated`);
	});
});

