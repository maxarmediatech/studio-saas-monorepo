import type { SmsTemplate } from "../types";

// TODO: Update flowId and dltTemplateId after MSG91 registration

export const bookingConfirmation: SmsTemplate = {
	id: "booking-confirmation",
	flowId: "FLOW_BOOKING_CONFIRM",
	dltTemplateId: "DLT_BOOKING_CONFIRM",
	name: "Booking Confirmation",
	variables: {
		clientName: "string",
		bookingDate: "string",
		shootType: "string",
	},
};

export const shootReminder: SmsTemplate = {
	id: "shoot-reminder",
	flowId: "FLOW_SHOOT_REMINDER",
	dltTemplateId: "DLT_SHOOT_REMINDER",
	name: "Shoot Reminder",
	variables: {
		clientName: "string",
		shootDate: "string",
		location: "string",
	},
};

export const crewAssignment: SmsTemplate = {
	id: "crew-assignment",
	flowId: "FLOW_CREW_ASSIGNMENT",
	dltTemplateId: "DLT_CREW_ASSIGNMENT",
	name: "Crew Assignment",
	variables: {
		crewName: "string",
		shootDate: "string",
		role: "string",
		location: "string",
	},
};

export const paymentReminder: SmsTemplate = {
	id: "payment-reminder",
	flowId: "FLOW_PAYMENT_REMINDER",
	dltTemplateId: "DLT_PAYMENT_REMINDER",
	name: "Payment Reminder",
	variables: {
		clientName: "string",
		amount: "string",
		dueDate: "string",
		invoiceNumber: "string",
	},
};

// Template registry
export const smsTemplates: Record<string, SmsTemplate> = {
	"booking-confirmation": bookingConfirmation,
	"shoot-reminder": shootReminder,
	"crew-assignment": crewAssignment,
	"payment-reminder": paymentReminder,
};

export type TemplateId = keyof typeof smsTemplates;

export function getTemplate(templateId: TemplateId): SmsTemplate {
	const template = smsTemplates[templateId];
	if (!template) {
		throw new Error(`SMS template not found: ${String(templateId)}`);
	}
	return template;
}
