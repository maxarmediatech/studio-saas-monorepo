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

// Bookings
import { BookingDetailSheet, BookingEditSheet } from "./bookings/sheets";
// Clients
import { ClientCreateSheet, ClientEditSheet } from "./clients/sheets";
// Configurations
import {
	ConfigurationCreateSheet,
	ConfigurationEditSheet,
} from "./configurations/sheets";
// Crews
import { CrewCreateSheet, CrewEditSheet } from "./crews/sheets";
// Deliverables
import {
	DeliverableCreateSheet,
	DeliverableEditSheet,
} from "./deliverables/sheets";
// Expenses
import { ExpenseCreateSheet, ExpenseEditSheet } from "./expenses/sheets";
// Payments
import { PaymentCreateSheet, PaymentEditSheet } from "./payments/sheets";
// Schedules (Payment Schedules)
import { ScheduleCreateSheet, ScheduleEditSheet } from "./schedules/sheets";
// Shoots
import { ShootCreateSheet, ShootEditSheet } from "./shoots/sheets";
// Tasks
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
		</>
	);
}
