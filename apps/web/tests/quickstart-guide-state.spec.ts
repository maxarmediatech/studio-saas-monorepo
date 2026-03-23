import { expect, test } from "@playwright/test";
import {
	isCanonicalQuickstartState,
	normalizeQuickstartState,
	shouldShowQuickstartGuide,
} from "../modules/saas/studio/components/home/widgets/quickstart-guide-state";

test.describe("quickstart guide state", () => {
	test("migrates legacy state into the canonical shape", () => {
		expect(
			normalizeQuickstartState({
				hide: false,
				createdBooking: true,
				version: 2,
			}),
		).toEqual({
			hide: false,
			version: 2,
		});
	});

	test("treats only the canonical v2 object as canonical", () => {
		expect(
			isCanonicalQuickstartState({
				hide: false,
				version: 2,
			}),
		).toBe(true);
		expect(
			isCanonicalQuickstartState({
				hide: false,
				version: 3,
			}),
		).toBe(false);
	});

	test("shows only for owners while the guide is not hidden", () => {
		const visibleState = {
			hide: false,
			version: 2 as const,
		};

		expect(
			shouldShowQuickstartGuide({
				activeOrganizationLoaded: true,
				activeOrganizationUserRole: "owner",
				state: visibleState,
			}),
		).toBe(true);
		expect(
			shouldShowQuickstartGuide({
				activeOrganizationLoaded: true,
				activeOrganizationUserRole: "admin",
				state: visibleState,
			}),
		).toBe(false);
		expect(
			shouldShowQuickstartGuide({
				activeOrganizationLoaded: false,
				activeOrganizationUserRole: "owner",
				state: visibleState,
			}),
		).toBe(false);
		expect(
			shouldShowQuickstartGuide({
				activeOrganizationLoaded: true,
				activeOrganizationUserRole: "owner",
				state: { ...visibleState, hide: true },
			}),
		).toBe(false);
	});
});
