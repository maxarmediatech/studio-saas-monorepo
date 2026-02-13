"use client";

/**
 * GlobalSheets Registry
 *
 * All URL-based sheets are mounted here and controlled via query parameters.
 * Sheets are always mounted but only visible when their corresponding param is set.
 *
 * Pattern:
 * - Create sheets: open when `create{Entity}=true`
 * - Edit sheets: open when `{entity}Id={id}` (wrapped in Suspense for data fetching)
 *
 * To add a new sheet:
 * 1. Create the sheet component in the entity's sheets/ folder
 * 2. Create a params hook in hooks/params/
 * 3. Import and add the sheet here
 * 4. Edit sheets should be wrapped in Suspense
 */

import { Suspense } from "react";

import { BookingDetailSheet, BookingEditSheet } from "./bookings/sheets";
import { ClientCreateSheet, ClientEditSheet } from "./clients/sheets";
import {
	ConfigurationCreateSheet,
	ConfigurationDetailSheet,
	ConfigurationEditSheet,
} from "./configurations/sheets";
import { CrewCreateSheet, CrewEditSheet } from "./crews/sheets";
import {
	DeliverableCreateSheet,
	DeliverableEditSheet,
} from "./deliverables/sheets";
import { DiscussionCreateSheet } from "./discussions/sheets";
import { ExpenseCreateSheet, ExpenseEditSheet } from "./expenses/sheets";
import { PaymentCreateSheet, PaymentEditSheet } from "./payments/sheets";
import {
	ScheduleConvertSheet,
	ScheduleCreateSheet,
	ScheduleEditSheet,
} from "./schedules/sheets";
import { ShootCreateSheet, ShootEditSheet } from "./shoots/sheets";
import { TaskCreateSheet, TaskEditSheet } from "./tasks/sheets";

export function GlobalSheets() {
	return (
		<>
			{/* Bookings - View Detail */}
			<Suspense fallback={null}>
				<BookingDetailSheet />
			</Suspense>
			<Suspense fallback={null}>
				<BookingEditSheet />
			</Suspense>

			{/* Clients */}
			<ClientCreateSheet />
			<Suspense fallback={null}>
				<ClientEditSheet />
			</Suspense>

			{/* Crews */}
			<CrewCreateSheet />
			<Suspense fallback={null}>
				<CrewEditSheet />
			</Suspense>

			{/* Configurations */}
			<ConfigurationCreateSheet />
			<Suspense fallback={null}>
				<ConfigurationDetailSheet />
			</Suspense>
			<Suspense fallback={null}>
				<ConfigurationEditSheet />
			</Suspense>

			{/* Shoots */}
			<ShootCreateSheet />
			<Suspense fallback={null}>
				<ShootEditSheet />
			</Suspense>

			{/* Payments */}
			<PaymentCreateSheet />
			<Suspense fallback={null}>
				<PaymentEditSheet />
			</Suspense>

			{/* Schedules (Payment Schedules) */}
			<ScheduleCreateSheet />
			<Suspense fallback={null}>
				<ScheduleEditSheet />
			</Suspense>
			<Suspense fallback={null}>
				<ScheduleConvertSheet />
			</Suspense>

			{/* Deliverables */}
			<DeliverableCreateSheet />
			<Suspense fallback={null}>
				<DeliverableEditSheet />
			</Suspense>

			{/* Tasks */}
			<TaskCreateSheet />
			<Suspense fallback={null}>
				<TaskEditSheet />
			</Suspense>

			{/* Expenses */}
			<ExpenseCreateSheet />
			<Suspense fallback={null}>
				<ExpenseEditSheet />
			</Suspense>

			{/* Discussions */}
			<DiscussionCreateSheet />
		</>
	);
}
