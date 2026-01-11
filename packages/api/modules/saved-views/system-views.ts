import type { SavedViewEntityType } from "../studio/schemas/saved-view";

export interface SystemViewDefinition {
	name: string;
	description: string;
	icon: string;
	filters: Record<string, unknown>;
	isDefault?: boolean;
	sortOrder: number;
}

export const systemViewDefinitions: Record<
	SavedViewEntityType,
	SystemViewDefinition[]
> = {
	booking: [
		{
			name: "All Bookings",
			description: "View all bookings",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "Active",
			description: "In-progress bookings",
			icon: "Clock",
			filters: {
				statuses: ["new", "preparation", "shooting", "delivery"],
			},
			sortOrder: 1,
		},
		{
			name: "Completed",
			description: "Finished bookings",
			icon: "CheckCircle",
			filters: { statuses: ["completed"] },
			sortOrder: 2,
		},
		{
			name: "Cancelled",
			description: "Cancelled bookings",
			icon: "XCircle",
			filters: { statuses: ["cancelled"] },
			sortOrder: 3,
		},
	],
	task: [
		{
			name: "All Tasks",
			description: "View all tasks",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "My Tasks",
			description: "Tasks assigned to me",
			icon: "User",
			filters: { assignedToMe: true },
			sortOrder: 1,
		},
		{
			name: "Pending",
			description: "Tasks not yet started",
			icon: "Clock",
			filters: { workflowStatus: ["not_started"] },
			sortOrder: 2,
		},
		{
			name: "In Progress",
			description: "Tasks currently being worked on",
			icon: "Loader",
			filters: { workflowStatus: ["in_progress"] },
			sortOrder: 3,
		},
		{
			name: "Overdue",
			description: "Tasks past their due date",
			icon: "AlertCircle",
			filters: { overdue: true },
			sortOrder: 4,
		},
	],
	shoot: [
		{
			name: "All Shoots",
			description: "View all shoots",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "Upcoming",
			description: "Scheduled for the future",
			icon: "Calendar",
			filters: { upcoming: true },
			sortOrder: 1,
		},
		{
			name: "Today",
			description: "Shoots happening today",
			icon: "Sun",
			filters: { today: true },
			sortOrder: 2,
		},
		{
			name: "My Shoots",
			description: "Shoots I'm assigned to",
			icon: "User",
			filters: { assignedToMe: true },
			sortOrder: 3,
		},
	],
	deliverable: [
		{
			name: "All Deliverables",
			description: "View all deliverables",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "Pending",
			description: "Not yet started",
			icon: "Clock",
			filters: { workflowStatus: ["not_started"] },
			sortOrder: 1,
		},
		{
			name: "In Progress",
			description: "Currently being worked on",
			icon: "Loader",
			filters: { workflowStatus: ["in_progress"] },
			sortOrder: 2,
		},
		{
			name: "Ready for Review",
			description: "Awaiting client review",
			icon: "Eye",
			filters: { workflowStatus: ["in_review"] },
			sortOrder: 3,
		},
	],
	payment: [
		{
			name: "All Payments",
			description: "View all received payments",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "This Month",
			description: "Payments received this month",
			icon: "Calendar",
			filters: { thisMonth: true },
			sortOrder: 1,
		},
	],
	schedule: [
		{
			name: "All Schedules",
			description: "View all payment schedules",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "Pending",
			description: "Payments not yet received",
			icon: "Clock",
			filters: { status: ["pending"] },
			sortOrder: 1,
		},
		{
			name: "Overdue",
			description: "Past due date",
			icon: "AlertCircle",
			filters: { status: ["overdue"] },
			sortOrder: 2,
		},
	],
	expense: [
		{
			name: "All Expenses",
			description: "View all expenses",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "Studio Expenses",
			description: "Billed to studio",
			icon: "Building",
			filters: { billTo: "studio" },
			sortOrder: 1,
		},
		{
			name: "Client Expenses",
			description: "Billed to client",
			icon: "User",
			filters: { billTo: "client" },
			sortOrder: 2,
		},
	],
	crew: [
		{
			name: "All Crew",
			description: "View all crew members",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "Active",
			description: "Currently active crew",
			icon: "UserCheck",
			filters: { status: "active" },
			sortOrder: 1,
		},
	],
	client: [
		{
			name: "All Clients",
			description: "View all clients",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "Recent",
			description: "Recently added clients",
			icon: "Clock",
			filters: { recent: true },
			sortOrder: 1,
		},
	],
	invoice: [
		{
			name: "All Invoices",
			description: "View all invoices",
			icon: "List",
			filters: {},
			isDefault: true,
			sortOrder: 0,
		},
		{
			name: "Draft",
			description: "Unpublished invoices",
			icon: "FileEdit",
			filters: { status: ["draft"] },
			sortOrder: 1,
		},
		{
			name: "Sent",
			description: "Sent to clients",
			icon: "Send",
			filters: { status: ["sent"] },
			sortOrder: 2,
		},
		{
			name: "Paid",
			description: "Fully paid invoices",
			icon: "CheckCircle",
			filters: { status: ["paid"] },
			sortOrder: 3,
		},
	],
};
