import { expect, test } from "@playwright/test";
import {
	buildStudioRoutePath,
	getStudioRoutePermission,
} from "../modules/saas/studio/lib/route-access";

test.describe("studio route access", () => {
	test("matches nested bookings routes to the bookings permission", () => {
		expect(
			getStudioRoutePermission(
				"stuwiz",
				buildStudioRoutePath("stuwiz", "/bookings/new/details"),
			),
		).toEqual({
			any: [{ resource: "booking", action: "list" }],
		});
	});

	test("matches configuration child routes to the configuration permission", () => {
		expect(
			getStudioRoutePermission(
				"stuwiz",
				buildStudioRoutePath("stuwiz", "/configurations/package-types"),
			),
		).toEqual({
			any: [{ resource: "configuration", action: "list" }],
		});
	});

	test("returns undefined for unrestricted routes", () => {
		expect(
			getStudioRoutePermission(
				"stuwiz",
				buildStudioRoutePath("stuwiz", "/home"),
			),
		).toBeUndefined();
	});
});
