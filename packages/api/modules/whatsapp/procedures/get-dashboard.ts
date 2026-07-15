import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	addDays,
	formatDateParts,
	getDateParts,
	normalizeTimeZone,
} from "../../studio/lib/date-helpers";
import { getWhatsAppDashboardData } from "../lib/dashboard";
import {
	whatsappDashboardInputSchema,
	whatsappDashboardOutputSchema,
} from "../types";

export const getDashboard = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/dashboard",
		tags: ["WhatsApp"],
		summary: "Get WhatsApp dashboard",
	})
	.input(whatsappDashboardInputSchema)
	.output(whatsappDashboardOutputSchema)
	.handler(async ({ input, context }) => {
		const timeZone = normalizeTimeZone(
			context.membership.organization.timezone,
		);
		const todayParts = getDateParts(new Date(), timeZone);
		const today = formatDateParts(todayParts);
		const rangeStart = input.dateRange?.start ?? addDays(today, -30);
		const rangeEnd = input.dateRange?.end ?? today;

		const data = await getWhatsAppDashboardData({
			organizationId: context.organizationId,
			today,
			rangeStartDate: new Date(`${rangeStart}T00:00:00.000Z`),
			rangeEndDate: new Date(`${rangeEnd}T23:59:59.999Z`),
		});

		return { data };
	});
