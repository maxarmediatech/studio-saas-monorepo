import type { BookingListItem } from "@repo/api/modules/studio/schemas/booking";
import type { Client } from "@repo/api/modules/studio/schemas/client";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import type { Crew } from "@repo/api/modules/studio/schemas/crew";
import type { DeliverableListItem } from "@repo/api/modules/studio/schemas/deliverable";
import type { ExpenseListItem } from "@repo/api/modules/studio/schemas/expense";
import type { InvoiceListItem } from "@repo/api/modules/studio/schemas/invoice";
import type { ReceivedAmountListItem, PaymentScheduleListItem } from "@repo/api/modules/studio/schemas/payment";
import type { ReceiptListItem } from "@repo/api/modules/studio/schemas/receipt";
import type { ShootListItem } from "@repo/api/modules/studio/schemas/shoot";
import type { TaskListItem } from "@repo/api/modules/studio/schemas/task";
import { formatDate, formatDateTime, formatMoneyValue } from "./format";
import type { TableExportColumn, TableExportEntity } from "./types";

function joinNames(items: Array<string | null | undefined>): string {
	return items.filter(Boolean).join(", ");
}

function formatShootType(type: string): string {
	return type
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

const bookingColumns: TableExportColumn<BookingListItem>[] = [
	{ id: "referenceNumber", header: "ID", value: (row) => row.referenceNumber },
	{ id: "name", header: "Name", value: (row) => row.name },
	{ id: "bookingType", header: "Booking Type", value: (row) => row.bookingType },
	{ id: "packageType", header: "Package", value: (row) => row.packageType },
	{ id: "packageCost", header: "Package Cost", value: (row) => formatMoneyValue(row.packageCost) },
	{ id: "balance", header: "Balance", value: (row) => formatMoneyValue(row.balance) },
	{ id: "shoots", header: "Shoots", value: (row) => row.shootsCount },
	{
		id: "participants",
		header: "Clients",
		value: (row) => joinNames(row.participants.map((participant) => participant.client.name)),
	},
	{ id: "createdAt", header: "Created", value: (row) => formatDateTime(row.createdAt) },
];

const clientColumns: TableExportColumn<Client>[] = [
	{ id: "name", header: "Name", value: (row) => row.name },
	{ id: "email", header: "Email", value: (row) => row.email },
	{ id: "phoneNumber", header: "Phone", value: (row) => row.phoneNumber },
	{ id: "address", header: "Address", value: (row) => row.address },
	{ id: "createdAt", header: "Created", value: (row) => formatDateTime(row.createdAt) },
];

const shootColumns: TableExportColumn<ShootListItem>[] = [
	{ id: "shootDate", header: "Date", value: (row) => formatDate(row.shootDate) },
	{
		id: "eventBooking",
		header: "Shoot",
		value: (row) => `${formatShootType(row.shootType)} · ${row.bookingName}`,
	},
	{
		id: "time",
		header: "Time",
		value: (row) =>
			row.startTime ? `${row.startTime}${row.endTime ? ` - ${row.endTime}` : ""}` : "",
	},
	{ id: "venue", header: "Location", value: (row) => row.venue },
	{ id: "status", header: "Status", value: (row) => row.status },
	{
		id: "assignmentsCount",
		header: "Crew Plan",
		value: (row) =>
			row.requiredCrewCount
				? `${row.assignmentsCount} / ${row.requiredCrewCount}`
				: row.assignmentsCount,
	},
	{
		id: "additionalServices",
		header: "Extra Services",
		value: (row) => row.additionalServices,
	},
];

const taskColumns: TableExportColumn<TaskListItem>[] = [
	{ id: "name", header: "Name", value: (row) => row.name },
	{
		id: "booking",
		header: "Booking",
		value: (row) => `${row.bookingReferenceNumber} · ${row.bookingName}`,
	},
	{ id: "status", header: "Status", value: (row) => row.status },
	{ id: "priority", header: "Priority", value: (row) => row.priority },
	{ id: "dueDate", header: "Due Date", value: (row) => formatDate(row.dueDate) },
	{ id: "assignmentsCount", header: "Assignees", value: (row) => row.assignmentsCount },
];

const deliverableColumns: TableExportColumn<DeliverableListItem>[] = [
	{ id: "name", header: "Name", value: (row) => row.name },
	{
		id: "booking",
		header: "Booking",
		value: (row) => `${row.bookingReferenceNumber} · ${row.bookingName}`,
	},
	{ id: "dueDate", header: "Due Date", value: (row) => formatDate(row.dueDate) },
	{ id: "status", header: "Status", value: (row) => row.status },
	{ id: "assignmentsCount", header: "Assignees", value: (row) => row.assignmentsCount },
	{ id: "packageType", header: "Package", value: (row) => row.bookingPackageType },
	{ id: "cost", header: "Cost", value: (row) => formatMoneyValue(row.cost) },
];

const crewColumns: TableExportColumn<Crew>[] = [
	{ id: "name", header: "Name", value: (row) => row.name },
	{ id: "workerType", header: "Worker Type", value: (row) => row.workerType },
	{ id: "hasAppAccess", header: "App Access", value: (row) => row.hasAppAccess },
	{ id: "displayRoles", header: "Roles", value: (row) => row.displayRoles },
	{ id: "specializations", header: "Specializations", value: (row) => row.specializations },
	{ id: "phoneNumber", header: "Phone", value: (row) => row.phoneNumber },
	{ id: "status", header: "Status", value: (row) => row.status },
	{ id: "dailyRate", header: "Daily Rate", value: (row) => formatMoneyValue(row.dailyRate) },
];

const invoiceColumns: TableExportColumn<InvoiceListItem>[] = [
	{ id: "invoiceNumber", header: "Invoice Number", value: (row) => row.invoiceNumber },
	{
		id: "booking",
		header: "Booking",
		value: (row) => `${row.bookingReferenceNumber} · ${row.bookingName}`,
	},
	{ id: "totalAmount", header: "Total Amount", value: (row) => formatMoneyValue(row.totalAmount) },
	{ id: "status", header: "Status", value: (row) => row.status },
	{ id: "issueDate", header: "Issue Date", value: (row) => formatDate(row.issueDate) },
];

const receiptColumns: TableExportColumn<ReceiptListItem>[] = [
	{ id: "receiptNumber", header: "Receipt Number", value: (row) => row.receiptNumber },
	{
		id: "booking",
		header: "Booking",
		value: (row) => `${row.bookingReferenceNumber} · ${row.bookingName}`,
	},
	{ id: "invoice", header: "Invoice", value: (row) => row.invoiceNumber },
	{ id: "amount", header: "Amount", value: (row) => formatMoneyValue(row.amount) },
	{ id: "paymentMethod", header: "Payment Method", value: (row) => row.paymentMethod },
	{ id: "receiptDate", header: "Receipt Date", value: (row) => formatDate(row.receiptDate) },
];

const expenseColumns: TableExportColumn<ExpenseListItem>[] = [
	{ id: "description", header: "Description", value: (row) => row.description },
	{ id: "amount", header: "Amount", value: (row) => formatMoneyValue(row.amount) },
	{
		id: "booking",
		header: "Booking",
		value: (row) =>
			row.bookingReferenceNumber && row.bookingName
				? `${row.bookingReferenceNumber} · ${row.bookingName}`
				: "",
	},
	{ id: "category", header: "Category", value: (row) => row.category },
	{ id: "expenseDate", header: "Expense Date", value: (row) => formatDate(row.expenseDate) },
	{ id: "billTo", header: "Bill To", value: (row) => row.billTo },
	{ id: "paymentMethod", header: "Payment Method", value: (row) => row.paymentMethod },
];

const paymentColumns: TableExportColumn<ReceivedAmountListItem>[] = [
	{
		id: "booking",
		header: "Booking",
		value: (row) => `${row.bookingReferenceNumber} · ${row.bookingName}`,
	},
	{ id: "amount", header: "Amount", value: (row) => formatMoneyValue(row.amount) },
	{ id: "paymentMethod", header: "Payment Method", value: (row) => row.paymentMethod },
	{ id: "receivedDate", header: "Received Date", value: (row) => formatDate(row.receivedDate) },
	{
		id: "transactionReference",
		header: "Transaction Reference",
		value: (row) => row.transactionReference,
	},
];

const scheduleColumns: TableExportColumn<PaymentScheduleListItem>[] = [
	{
		id: "booking",
		header: "Booking",
		value: (row) => `${row.bookingReferenceNumber} · ${row.bookingName}`,
	},
	{ id: "name", header: "Name", value: (row) => row.name },
	{ id: "dueDate", header: "Due Date", value: (row) => formatDate(row.dueDate) },
	{ id: "amount", header: "Amount", value: (row) => formatMoneyValue(row.amount) },
	{ id: "paid", header: "Paid", value: (row) => formatMoneyValue(row.paidAmount) },
	{ id: "status", header: "Status", value: (row) => row.status },
];

const configurationColumns: TableExportColumn<Configuration>[] = [
	{ id: "label", header: "Label", value: (row) => row.label },
	{ id: "defaultCost", header: "Default Cost", value: (row) => formatMoneyValue(row.defaultCost) },
	{ id: "bookingTypeFilter", header: "Booking Type", value: (row) => row.bookingTypeFilter ?? "All" },
	{
		id: "applicableRoles",
		header: "Applicable Roles",
		value: (row) => {
			const roles = row.metadata?.roles;
			return Array.isArray(roles) && roles.length > 0 ? roles : "All roles";
		},
	},
	{
		id: "applicableBookingTypes",
		header: "Booking Types",
		value: (row) => {
			const bookingTypes = row.metadata?.bookingTypes;
			return Array.isArray(bookingTypes) && bookingTypes.length > 0
				? bookingTypes
				: "All types";
		},
	},
	{ id: "sortOrder", header: "Order", value: (row) => row.sortOrder },
	{ id: "isDefault", header: "Default", value: (row) => row.isDefault },
	{ id: "isActive", header: "Status", value: (row) => (row.isActive ? "Active" : "Inactive") },
];

export const tableExportColumns: Record<TableExportEntity, TableExportColumn<any>[]> = {
	booking: bookingColumns,
	client: clientColumns,
	configuration: configurationColumns,
	crew: crewColumns,
	deliverable: deliverableColumns,
	expense: expenseColumns,
	invoice: invoiceColumns,
	payment: paymentColumns,
	receipt: receiptColumns,
	schedule: scheduleColumns,
	shoot: shootColumns,
	task: taskColumns,
};
