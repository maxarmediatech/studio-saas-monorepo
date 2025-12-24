import { z } from "zod";

/**
 * Decimal string validator for currency inputs
 */
export const decimalStringSchema = z.string().transform((val, ctx) => {
	const cleaned = val.replace(/[^\d.]/g, "");
	const parsed = Number.parseFloat(cleaned);
	if (Number.isNaN(parsed)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Must be a valid number",
		});
		return z.NEVER;
	}
	return parsed.toFixed(2);
});

/**
 * Participant schema - links a client to the booking with a role
 */
export const participantSchema = z.object({
	clientId: z.string().min(1, "Client is required"),
	role: z.string().min(1, "Role is required"),
});

export type ParticipantFormValue = z.infer<typeof participantSchema>;

/**
 * Event schema - booking events (wedding day, mehendi, etc.)
 */
export const eventSchema = z.object({
	eventType: z.string().min(1, "Event type is required"),
	eventDate: z.string().min(1, "Event date is required"),
	venue: z.string().optional(),
	venueAddress: z.string().optional(),
	notes: z.string().optional(),
});

export type EventFormValue = z.infer<typeof eventSchema>;

/**
 * Main booking form schema
 */
export const bookingFormSchema = z.object({
	// Step 1: Details
	name: z.string().min(1, "Booking name is required"),
	bookingType: z.string().min(1, "Booking type is required"),
	packageType: z.string().min(1, "Package type is required"),
	packageCost: decimalStringSchema,
	note: z.string().optional(),
	participants: z
		.array(participantSchema)
		.min(1, "At least one participant is required"),

	// Step 2: Events
	events: z.array(eventSchema).optional(),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

/**
 * Default form values
 */
export const defaultBookingValues: BookingFormValues = {
	name: "",
	bookingType: "",
	packageType: "",
	packageCost: "0.00",
	note: "",
	participants: [
		{
			clientId: "",
			role: "",
		},
	],
	events: [],
};

/**
 * Tab configuration for multi-step wizard
 */
export const BOOKING_TABS = ["details", "events"] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

/**
 * Mapping of tabs to their form fields (for error tracking)
 */
export const TAB_FIELD_MAPPING: Record<BookingTab, string[]> = {
	details: [
		"name",
		"bookingType",
		"packageType",
		"packageCost",
		"note",
		"participants",
	],
	events: ["events"],
};

/**
 * Tab labels for display
 */
export const TAB_LABELS: Record<BookingTab, string> = {
	details: "Details",
	events: "Events",
};
