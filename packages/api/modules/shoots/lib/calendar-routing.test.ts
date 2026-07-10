import { describe, expect, it } from "vitest";
import { resolveCalendarDeliveryRoute } from "./calendar-routing";

describe("resolveCalendarDeliveryRoute", () => {
	it("prefers Google when connected", () => {
		expect(
			resolveCalendarDeliveryRoute({
				hasGoogleConnection: true,
				email: "crew@example.com",
			}),
		).toEqual({ deliveryMethod: "google", recipientEmail: null });
	});

	it("uses ICS for any crew email when Google is unavailable", () => {
		expect(
			resolveCalendarDeliveryRoute({
				hasGoogleConnection: false,
				email: " registered@example.com ",
			}),
		).toEqual({
			deliveryMethod: "ics",
			recipientEmail: "registered@example.com",
		});
	});

	it("marks blank or missing email as unsendable", () => {
		expect(
			resolveCalendarDeliveryRoute({
				hasGoogleConnection: false,
				email: "   ",
			}),
		).toEqual({ deliveryMethod: "unsendable", recipientEmail: null });
	});
});
