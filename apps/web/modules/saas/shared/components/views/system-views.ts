import type { SavedViewEntityType } from "./types";

export interface SystemView {
	id: string;
	name: string;
	description: string;
	icon: string;
	filters: Record<string, unknown>;
	isDefault?: boolean;
	sortOrder: number;
}

export const SYSTEM_VIEWS: Record<SavedViewEntityType, SystemView[]> = {
	booking: [
		{
			id: "all",
			name: "All Bookings",
			description: "View all bookings",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "active",
			name: "Active",
			description: "In-progress bookings",
			icon: "Clock",
			filters: {
				statuses: ["new", "preparation", "shooting", "delivery"],
			},
			sortOrder: 1,
		},
		{
			id: "completed",
			name: "Completed",
			description: "Finished bookings",
			icon: "CheckCircle",
			filters: { statuses: ["completed"] },
			sortOrder: 2,
		},
		{
			id: "cancelled",
			name: "Cancelled",
			description: "Cancelled bookings",
			icon: "XCircle",
			filters: { statuses: ["cancelled"] },
			sortOrder: 3,
		},
	],
	task: [
		{
			id: "all",
			name: "All Tasks",
			description: "View all tasks",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "pending",
			name: "Pending",
			description: "Tasks not yet started",
			icon: "Clock",
			filters: { status: ["pending"] },
			sortOrder: 1,
		},
		{
			id: "in-progress",
			name: "In Progress",
			description: "Tasks currently being worked on",
			icon: "Loader",
			filters: { status: ["in_progress"] },
			sortOrder: 2,
		},
		{
			id: "completed",
			name: "Completed",
			description: "Finished tasks",
			icon: "CheckCircle",
			filters: { status: ["completed"] },
			sortOrder: 3,
		},
		{
			id: "high-priority",
			name: "High Priority",
			description: "Urgent tasks",
			icon: "AlertTriangle",
			filters: { priority: ["high"] },
			sortOrder: 4,
		},
	],
	shoot: [
		{
			id: "all",
			name: "All Shoots",
			description: "View all shoots",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "scheduled",
			name: "Scheduled",
			description: "Upcoming scheduled shoots",
			icon: "Calendar",
			filters: { status: ["scheduled"] },
			sortOrder: 1,
		},
		{
			id: "confirmed",
			name: "Confirmed",
			description: "Confirmed shoots",
			icon: "CheckCircle",
			filters: { status: ["confirmed"] },
			sortOrder: 2,
		},
		{
			id: "in-progress",
			name: "In Progress",
			description: "Currently happening",
			icon: "PlayCircle",
			filters: { status: ["in_progress"] },
			sortOrder: 3,
		},
		{
			id: "completed",
			name: "Completed",
			description: "Finished shoots",
			icon: "CheckCircle2",
			filters: { status: ["completed"] },
			sortOrder: 4,
		},
	],
	deliverable: [
		{
			id: "all",
			name: "All Deliverables",
			description: "View all deliverables",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "pending",
			name: "Pending",
			description: "Not yet started",
			icon: "Clock",
			filters: { status: ["pending"] },
			sortOrder: 1,
		},
		{
			id: "in-progress",
			name: "In Progress",
			description: "Currently being worked on",
			icon: "Loader",
			filters: { status: ["in_progress"] },
			sortOrder: 2,
		},
		{
			id: "completed",
			name: "Completed",
			description: "Finished deliverables",
			icon: "CheckCircle",
			filters: { status: ["completed"] },
			sortOrder: 3,
		},
		{
			id: "delivered",
			name: "Delivered",
			description: "Sent to client",
			icon: "Send",
			filters: { status: ["delivered"] },
			sortOrder: 4,
		},
	],
	payment: [
		{
			id: "all",
			name: "All Payments",
			description: "View all received payments",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "cash",
			name: "Cash Payments",
			description: "Payments received in cash",
			icon: "Banknote",
			filters: { paymentMethod: ["cash"] },
			sortOrder: 1,
		},
		{
			id: "upi",
			name: "UPI Payments",
			description: "Payments via UPI",
			icon: "Smartphone",
			filters: { paymentMethod: ["upi"] },
			sortOrder: 2,
		},
		{
			id: "bank-transfer",
			name: "Bank Transfers",
			description: "Direct bank transfers",
			icon: "Building",
			filters: { paymentMethod: ["bank_transfer"] },
			sortOrder: 3,
		},
	],
	schedule: [
		{
			id: "all",
			name: "All Schedules",
			description: "View all payment schedules",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "pending",
			name: "Pending",
			description: "Payments not yet received",
			icon: "Clock",
			filters: { status: ["pending"] },
			sortOrder: 1,
		},
		{
			id: "overdue",
			name: "Overdue",
			description: "Past due date",
			icon: "AlertCircle",
			filters: { status: ["overdue"] },
			sortOrder: 2,
		},
	],
	expense: [
		{
			id: "all",
			name: "All Expenses",
			description: "View all expenses",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "studio",
			name: "Studio Expenses",
			description: "Billed to studio",
			icon: "Building",
			filters: { billTo: ["studio"] },
			sortOrder: 1,
		},
		{
			id: "client",
			name: "Client Expenses",
			description: "Billed to client",
			icon: "User",
			filters: { billTo: ["client"] },
			sortOrder: 2,
		},
	],
	crew: [
		{
			id: "all",
			name: "All Crew",
			description: "View all crew members",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "active",
			name: "Active",
			description: "Currently active crew",
			icon: "UserCheck",
			filters: { status: ["active"] },
			sortOrder: 1,
		},
		{
			id: "inactive",
			name: "Inactive",
			description: "Inactive crew members",
			icon: "UserX",
			filters: { status: ["inactive"] },
			sortOrder: 2,
		},
	],
	client: [
		{
			id: "all",
			name: "All Clients",
			description: "View all clients",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
	],
	invoice: [
		{
			id: "all",
			name: "All Invoices",
			description: "View all invoices",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			id: "draft",
			name: "Draft",
			description: "Unpublished invoices",
			icon: "FileEdit",
			filters: { status: ["draft"] },
			sortOrder: 1,
		},
		{
			id: "sent",
			name: "Sent",
			description: "Sent to clients",
			icon: "Send",
			filters: { status: ["sent"] },
			sortOrder: 2,
		},
		{
			id: "paid",
			name: "Paid",
			description: "Fully paid invoices",
			icon: "CheckCircle",
			filters: { status: ["paid"] },
			sortOrder: 3,
		},
	],
};

export function getSystemViews(entityType: SavedViewEntityType): SystemView[] {
	return SYSTEM_VIEWS[entityType] || [];
}

export function getSystemView(
	entityType: SavedViewEntityType,
	viewId: string,
): SystemView | undefined {
	return SYSTEM_VIEWS[entityType]?.find((v) => v.id === viewId);
}

export function isSystemViewId(viewId: string | null): boolean {
	if (!viewId) return false;
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	return !uuidRegex.test(viewId);
}

export function getDefaultSystemView(
	entityType: SavedViewEntityType,
): SystemView | undefined {
	return SYSTEM_VIEWS[entityType]?.find((v) => v.isDefault);
}
