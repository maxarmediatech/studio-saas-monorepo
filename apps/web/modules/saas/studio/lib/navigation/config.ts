import type {
	NavAreaConfig,
	NavItemConfig,
	NavigationConfig,
	NavModuleConfig,
} from "./types";

/**
 * Build the URL for a navigation item, prefixed with the studio base path
 */
function buildUrl(studioSlug: string, path: string): string {
	return `/app/${studioSlug}${path}`;
}

/**
 * Get navigation configuration for a studio.
 * URLs are built dynamically based on the studio slug.
 * Permissions are defined for each item to enable RBAC filtering.
 *
 * Structure matches winter-arc/studio-saas pattern:
 * - 6 modules as header tabs: Overview, Production, Operations, Finance, CRM, System
 * - Each module has sections with items
 * - Utilities (Settings) shown in sidebar footer
 */
export function getNavigationConfig(studioSlug: string): NavigationConfig {
	const url = (path: string) => buildUrl(studioSlug, path);

	const modules: NavModuleConfig[] = [
		{
			id: "workspace",
			label: "Workspace",
			icon: "Home",
			defaultPath: url("/home"),
			sections: [
				{
					id: "workspace-core",
					items: [
						{
							id: "home",
							label: "Home",
							path: url("/home"),
							icon: "Home",
						},
						{
							id: "dashboard",
							label: "Dashboard",
							path: url("/dashboard"),
							icon: "LayoutDashboard",
							permission: {
								any: [
									{ resource: "dashboard", action: "read" },
								],
							},
						},
						{
							id: "your-work",
							label: "Your Work",
							path: url("/your-work"),
							icon: "ListChecks",
							permission: {
								any: [
									{ resource: "task", action: "list" },
									{ resource: "deliverable", action: "list" },
									{ resource: "shoot", action: "list" },
								],
							},
						},
						{
							id: "stickies",
							label: "Stickies",
							path: url("/stickies"),
							icon: "StickyNoteIcon",
						},
						{
							id: "activities",
							label: "Activities",
							path: url("/activities"),
							icon: "Activity",
						},
					],
				},
				{
					id: "workspace-crm",
					label: "CRM",
					items: [
						{
							id: "clients",
							label: "Clients",
							path: url("/clients"),
							icon: "Contact2",
							permission: {
								any: [{ resource: "client", action: "list" }],
							},
						},
						// Future: Leads, Communications
					],
				},
				// Future: Pinned Bookings section
				// {
				// 	id: "workspace-pinned",
				// 	label: "Pinned",
				// 	items: [],
				// },
			],
		},
		{
			id: "studio",
			label: "Studio",
			icon: "Store",
			defaultPath: url("/bookings"),
			sections: [
				{
					id: "studio-bookings",
					items: [
						{
							id: "bookings",
							label: "Bookings",
							path: url("/bookings"),
							icon: "CalendarDays",
							permission: {
								any: [{ resource: "booking", action: "list" }],
							},
						},
					],
				},
				{
					id: "studio-production",
					label: "Production",
					items: [
						{
							id: "shoots",
							label: "Shoots",
							path: url("/shoots"),
							icon: "Camera",
							permission: {
								any: [{ resource: "shoot", action: "list" }],
							},
						},
						{
							id: "deliverables",
							label: "Deliverables",
							path: url("/deliverables"),
							icon: "Package",
							permission: {
								any: [
									{ resource: "deliverable", action: "list" },
								],
							},
						},
						{
							id: "tasks",
							label: "Tasks",
							path: url("/tasks"),
							icon: "ListTodo",
							permission: {
								any: [{ resource: "task", action: "list" }],
							},
						},
					],
				},
				{
					id: "studio-finance",
					label: "Finance",
					items: [
						{
							id: "payments",
							label: "Payments",
							path: url("/payments"),
							icon: "Wallet2",
							permission: {
								any: [{ resource: "payment", action: "list" }],
							},
						},
						{
							id: "scheduled-payments",
							label: "Scheduled",
							path: url("/scheduled-payments"),
							icon: "CreditCard",
							permission: {
								any: [{ resource: "payment", action: "list" }],
							},
						},
						{
							id: "expenses",
							label: "Expenses",
							path: url("/expenses"),
							icon: "Banknote",
							permission: {
								any: [{ resource: "expense", action: "list" }],
							},
						},
					],
				},
				{
					id: "studio-team",
					label: "Team",
					items: [
						{
							id: "crew",
							label: "Crew",
							path: url("/crews"),
							icon: "Users",
							permission: {
								any: [{ resource: "crew", action: "list" }],
							},
						},
					],
				},
				{
					id: "studio-setup",
					label: "Setup",
					items: [
						{
							id: "booking-types",
							label: "Booking Types",
							path: url("/configurations/booking-types"),
							icon: "Tag",
							permission: {
								any: [
									{
										resource: "configuration",
										action: "list",
									},
								],
							},
						},
						{
							id: "package-types",
							label: "Package Types",
							path: url("/configurations/package-types"),
							icon: "Package",
							permission: {
								any: [
									{
										resource: "configuration",
										action: "list",
									},
								],
							},
						},
						{
							id: "event-types",
							label: "Event Types",
							path: url("/configurations/event-types"),
							icon: "Sparkles",
							permission: {
								any: [
									{
										resource: "configuration",
										action: "list",
									},
								],
							},
						},
						{
							id: "relation-types",
							label: "Relation Types",
							path: url("/configurations/relation-types"),
							icon: "Link2",
							permission: {
								any: [
									{
										resource: "configuration",
										action: "list",
									},
								],
							},
						},
						{
							id: "crew-roles",
							label: "Crew Roles",
							path: url("/configurations/crew-roles"),
							icon: "UserCog",
							permission: {
								any: [
									{
										resource: "configuration",
										action: "list",
									},
								],
							},
						},
					],
				},
			],
		},
	];

	// Utilities removed - Settings is now accessible via gear icon in rail + org dropdown
	const utilities: NavItemConfig[] = [];

	// Settings areas (Dub-style separate sidebar panels)
	const areas: Record<string, NavAreaConfig> = {
		studioSettings: {
			id: "studioSettings",
			title: "Settings",
			backHref: url("/home"),
			direction: "right",
			sections: [
				{
					id: "studio",
					label: "Studio",
					items: [
						{
							id: "general",
							label: "General",
							path: url("/settings"),
							icon: "Settings2",
						},
						{
							id: "members",
							label: "Members",
							path: url("/settings/members"),
							icon: "Users",
						},
						{
							id: "billing",
							label: "Billing",
							path: url("/settings/billing"),
							icon: "CreditCard",
						},
						{
							id: "danger-zone",
							label: "Danger Zone",
							path: url("/settings/danger-zone"),
							icon: "AlertTriangle",
						},
					],
				},
				{
					id: "account",
					label: "Account",
					items: [
						{
							id: "profile",
							label: "Profile",
							path: url("/settings/profile"),
							icon: "User",
						},
						{
							id: "security",
							label: "Security",
							path: url("/settings/security"),
							icon: "Shield",
						},
						{
							id: "notifications",
							label: "Notifications",
							path: url("/settings/notifications"),
							icon: "Bell",
						},
					],
				},
			],
		},
	};

	return { modules, utilities, areas };
}
