import { beforeEach, describe, expect, it, vi } from "vitest";

const providerMocks = vi.hoisted(() => ({
	createAllDayEvent: vi.fn(),
	updateAllDayEvent: vi.fn(),
	deleteEvent: vi.fn(),
	getGoogleAccessToken: vi.fn(),
}));

vi.mock("@repo/google-calendar", () => ({
	createAllDayEvent: providerMocks.createAllDayEvent,
	updateAllDayEvent: providerMocks.updateAllDayEvent,
	deleteEvent: providerMocks.deleteEvent,
	createAllDayIcsFromGoogleInput: vi.fn(() => "BEGIN:VCALENDAR"),
}));

vi.mock("@repo/mail", () => ({
	sendCalendarInviteEmail: vi.fn(),
}));

vi.mock(
	"../../../../../services/calendar-worker/src/google-access-token",
	() => ({
		getGoogleAccessToken: providerMocks.getGoogleAccessToken,
	}),
);

import { performProviderEffect } from "../../../../../services/calendar-worker/src/provider-effects";

describe("calendar provider effects", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		providerMocks.getGoogleAccessToken.mockResolvedValue({
			config: { clientId: "client" },
			accessToken: "access-token",
		});
	});

	it("deletes from the immutable stored Google calendar", async () => {
		await performProviderEffect({ organizationId: "org-1" } as never, {
			operation: "cancellation",
			intentState: "cancelled",
			eventInput: { title: "Shoot", date: "2027-04-10" },
			target: {
				deliveryMethod: "google",
				recipientEmail: null,
				googleUserId: "user-1",
				googleConnectionId: "connection-1",
				googleAccountEmail: "crew@example.com",
				googleCreateId: null,
				calendarId: "team-calendar@example.com",
				googleEventId: "event-1",
				icalUid: null,
				icalSequence: 0,
			},
		});

		expect(providerMocks.deleteEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				calendarId: "team-calendar@example.com",
				googleEventId: "event-1",
			}),
		);
	});

	it("updates the immutable stored Google calendar", async () => {
		await performProviderEffect({ organizationId: "org-1" } as never, {
			operation: "delivery",
			intentState: "active",
			eventInput: { title: "Updated shoot", date: "2027-04-11" },
			target: {
				deliveryMethod: "google",
				recipientEmail: null,
				googleUserId: "user-1",
				googleConnectionId: "connection-1",
				googleAccountEmail: "crew@example.com",
				googleCreateId: null,
				calendarId: "team-calendar@example.com",
				googleEventId: "event-1",
				icalUid: null,
				icalSequence: 0,
			},
		});

		expect(providerMocks.updateAllDayEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				calendarId: "team-calendar@example.com",
				googleEventId: "event-1",
			}),
		);
	});
});
