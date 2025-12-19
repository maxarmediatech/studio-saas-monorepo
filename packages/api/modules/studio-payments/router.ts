import { listReceived } from "./procedures/received/list-received";
import { getReceived } from "./procedures/received/get-received";
import { createReceived } from "./procedures/received/create-received";
import { updateReceived } from "./procedures/received/update-received";
import { deleteReceived } from "./procedures/received/delete-received";
import { listSchedules } from "./procedures/schedules/list-schedules";
import { getSchedule } from "./procedures/schedules/get-schedule";
import { createSchedule } from "./procedures/schedules/create-schedule";
import { updateSchedule } from "./procedures/schedules/update-schedule";
import { deleteSchedule } from "./procedures/schedules/delete-schedule";
import { convertSchedule } from "./procedures/schedules/convert-schedule";
import { getPaymentStats } from "./procedures/get-payment-stats";

export const studioPaymentsRouter = {
	// Received amounts
	listReceived,
	getReceived,
	createReceived,
	updateReceived,
	deleteReceived,

	// Payment schedules
	listSchedules,
	getSchedule,
	createSchedule,
	updateSchedule,
	deleteSchedule,
	convertSchedule,

	// Stats
	stats: getPaymentStats,
};
