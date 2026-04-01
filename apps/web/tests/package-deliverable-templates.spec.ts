import { expect, test } from "@playwright/test";
import { PACKAGE_DELIVERABLE_TEMPLATES } from "../modules/saas/studio/components/configurations/package-deliverable-templates";

test.describe("package deliverable templates", () => {
	test("uses the reviewed wedding deliverable order", () => {
		expect(PACKAGE_DELIVERABLE_TEMPLATES).toEqual([
			{ title: "Wedding Album", quantity: 1 },
			{ title: "Full Wedding Video", quantity: 1 },
			{ title: "Wedding Highlight", quantity: 1 },
			{ title: "Edited Photos of Each Event", quantity: 1 },
		]);
	});
});
