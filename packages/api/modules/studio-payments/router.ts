import { getPaymentStats } from "./procedures/get-payment-stats";
import { createReceived } from "./procedures/received/create-received";
import { deleteReceived } from "./procedures/received/delete-received";
import { getReceived } from "./procedures/received/get-received";
import { listReceived } from "./procedures/received/list-received";
import { updateReceived } from "./procedures/received/update-received";
import { convertSchedule } from "./procedures/schedules/convert-schedule";
import { createSchedule } from "./procedures/schedules/create-schedule";
import { deleteSchedule } from "./procedures/schedules/delete-schedule";
import { getSchedule } from "./procedures/schedules/get-schedule";
import { listSchedules } from "./procedures/schedules/list-schedules";
import { listSchedulesMinimal } from "./procedures/schedules/list-schedules-minimal";
import { updateSchedule } from "./procedures/schedules/update-schedule";

export const studioPaymentsRouter = {
	// Received amounts
	listReceived,
	getReceived,
	createReceived,
	updateReceived,
	deleteReceived,

	// Payment schedules
	listSchedules,
	listSchedulesMinimal,
	getSchedule,
	createSchedule,
	updateSchedule,
	deleteSchedule,
	convertSchedule,

	// Stats
	stats: getPaymentStats,
};
