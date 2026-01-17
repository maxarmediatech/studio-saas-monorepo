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
		const draftEditor = page
			.locator(".sticky-editor .ProseMirror")
			.first();
		await expect(draftEditor).toBeVisible();
		await draftEditor.fill(content);

		await page.getByText("Stickies").click();

		const savedEditor = page
			.locator(".sticky-editor .ProseMirror")
			.filter({ hasText: content })
			.first();
		await expect(savedEditor).toBeVisible();

		await savedEditor.click();
		await expect(savedEditor).toBeFocused();
		await savedEditor.type(" updated");
		await page.waitForTimeout(700);

		await expect(savedEditor).toBeFocused();
		await expect(savedEditor).toContainText(`${content} updated`);
	});
});
