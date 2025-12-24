import { z } from "zod";
import {
	ClipboardListIcon,
	CameraIcon,
	WalletIcon,
	PackageIcon,
	CheckCircleIcon,
	type LucideIcon,
} from "lucide-react";

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
 * Shoot schema - photo/video shoots with crew assignments
 */
export const shootSchema = z.object({
	name: z.string().min(1, "Shoot name is required"),
	shootType: z.string().min(1, "Shoot type is required"),
	shootDate: z.string().min(1, "Shoot date is required"),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	venue: z.string().optional(),
	venueAddress: z.string().optional(),
	notes: z.string().optional(),
	// Crew assignments - array of crew IDs with their roles
	crewAssignments: z
		.array(
			z.object({
				crewId: z.string().min(1, "Crew member is required"),
				role: z.string().min(1, "Role is required"),
				isLead: z.boolean().default(false),
			}),
		)
		.optional(),
});

export type ShootFormValue = z.infer<typeof shootSchema>;

/**
 * Payment received schema
 */
export const paymentSchema = z.object({
	amount: decimalStringSchema,
	paymentMethod: z.enum([
		"cash",
		"upi",
		"bank_transfer",
		"cheque",
		"card",
		"other",
	]),
	receivedDate: z.string().min(1, "Payment date is required"),
	transactionReference: z.string().optional(),
	notes: z.string().optional(),
});

export type PaymentFormValue = z.infer<typeof paymentSchema>;

/**
 * Payment schedule schema
 */
export const paymentScheduleSchema = z.object({
	name: z.string().min(1, "Payment name is required"),
	amount: decimalStringSchema,
	dueDate: z.string().min(1, "Due date is required"),
	notes: z.string().optional(),
});

export type PaymentScheduleFormValue = z.infer<typeof paymentScheduleSchema>;

/**
 * Deliverable schema
 */
export const deliverableSchema = z.object({
	name: z.string().min(1, "Deliverable name is required"),
	deliverableType: z.string().min(1, "Deliverable type is required"),
	description: z.string().optional(),
	dueDate: z.string().optional(),
	// Crew assignments for deliverables
	crewAssignments: z
		.array(
			z.object({
				crewId: z.string().min(1, "Crew member is required"),
				isLead: z.boolean().default(false),
			}),
		)
		.optional(),
});

export type DeliverableFormValue = z.infer<typeof deliverableSchema>;

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

	// Step 2: Events (legacy - keeping for backward compatibility)
	events: z.array(eventSchema).optional(),

	// Step 3: Shoots (new - replaces events for production workflow)
	shoots: z.array(shootSchema).optional(),

	// Step 4: Payments
	payments: z.array(paymentSchema).optional(),
	paymentSchedules: z.array(paymentScheduleSchema).optional(),

	// Step 5: Deliverables
	deliverables: z.array(deliverableSchema).optional(),
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
	shoots: [],
	payments: [],
	paymentSchedules: [],
	deliverables: [],
};

/**
 * Tab configuration for multi-step wizard
 */
export const BOOKING_TABS = [
	"details",
	"shoots",
	"payments",
	"deliverables",
	"review",
] as const;
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
		"events",
	],
	shoots: ["shoots"],
	payments: ["payments", "paymentSchedules"],
	deliverables: ["deliverables"],
	review: [], // No form fields - just displays summary
};

/**
 * Tab labels for display
 */
export const TAB_LABELS: Record<BookingTab, string> = {
	details: "Details",
	shoots: "Shoots",
	payments: "Payments",
	deliverables: "Deliverables",
	review: "Review",
};

/**
 * Common shoot types
 */
export const SHOOT_TYPE_OPTIONS = [
	{ value: "pre_wedding", label: "Pre-Wedding" },
	{ value: "wedding", label: "Wedding" },
	{ value: "reception", label: "Reception" },
	{ value: "engagement", label: "Engagement" },
	{ value: "mehendi", label: "Mehendi" },
	{ value: "sangeet", label: "Sangeet" },
	{ value: "haldi", label: "Haldi" },
	{ value: "portrait", label: "Portrait" },
	{ value: "maternity", label: "Maternity" },
	{ value: "baby_shoot", label: "Baby Shoot" },
	{ value: "corporate", label: "Corporate" },
	{ value: "other", label: "Other" },
] as const;

/**
 * Common deliverable types
 */
export const DELIVERABLE_TYPE_OPTIONS = [
	{ value: "wedding_album", label: "Wedding Album" },
	{ value: "pre_wedding_album", label: "Pre-Wedding Album" },
	{ value: "photo_album", label: "Photo Album" },
	{ value: "highlight_video", label: "Highlight Video" },
	{ value: "full_video", label: "Full Video" },
	{ value: "teaser", label: "Teaser" },
	{ value: "reel", label: "Reel" },
	{ value: "edited_photos", label: "Edited Photos" },
	{ value: "raw_photos", label: "Raw Photos" },
	{ value: "raw_videos", label: "Raw Videos" },
	{ value: "drone_footage", label: "Drone Footage" },
	{ value: "frame", label: "Frame" },
	{ value: "canvas", label: "Canvas" },
	{ value: "other", label: "Other" },
] as const;

/**
 * Payment method options
 */
export const PAYMENT_METHOD_OPTIONS = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
] as const;

/**
 * Common payment schedule names
 */
export const PAYMENT_SCHEDULE_PRESETS = [
	{ value: "advance", label: "Advance Payment" },
	{ value: "before_wedding", label: "Before Wedding" },
	{ value: "after_wedding", label: "After Wedding" },
	{ value: "before_delivery", label: "Before Delivery" },
	{ value: "final", label: "Final Payment" },
] as const;

/**
 * Step configuration for the booking wizard
 */
export interface StepConfig {
	id: BookingTab;
	label: string;
	description: string;
	icon: LucideIcon;
}

export const STEP_CONFIG: StepConfig[] = [
	{
		id: "details",
		label: "Details",
		description: "Booking info & participants",
		icon: ClipboardListIcon,
	},
	{
		id: "shoots",
		label: "Shoots",
		description: "Schedule photo/video sessions",
		icon: CameraIcon,
	},
	{
		id: "payments",
		label: "Payments",
		description: "Record and plan payments",
		icon: WalletIcon,
	},
	{
		id: "deliverables",
		label: "Deliverables",
		description: "Define final outputs",
		icon: PackageIcon,
	},
	{
		id: "review",
		label: "Review",
		description: "Review & submit",
		icon: CheckCircleIcon,
	},
];
