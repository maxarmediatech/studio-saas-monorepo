export type CalendarDeliveryMethod = "google" | "ics" | "unsendable";

export function resolveCalendarDeliveryRoute(params: {
	hasGoogleConnection: boolean;
	email: string | null | undefined;
}): { deliveryMethod: CalendarDeliveryMethod; recipientEmail: string | null } {
	if (params.hasGoogleConnection) {
		return { deliveryMethod: "google", recipientEmail: null };
	}

	const email = params.email?.trim();
	if (email) {
		return { deliveryMethod: "ics", recipientEmail: email };
	}

	return { deliveryMethod: "unsendable", recipientEmail: null };
}
