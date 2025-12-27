import type { NavItemConfig, NavModuleConfig, NavigationConfig } from "./types";

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
			id: "overview",
			label: "Overview",
			icon: "LayoutDashboard",
			defaultPath: url("/home"),
			sections: [
				{
					id: "overview-core",
					label: "Overview",
					items: [
						{
							id: "home",
							label: "Home",
							path: url("/home"),
							icon: "Home",
							intent: "primary",
						},
						{
							id: "dashboard",
							label: "Dashboard",
							path: url("/dashboard"),
							icon: "LayoutDashboard",
							intent: "primary",
							permission: { any: [{ resource: "dashboard", action: "read" }] },
						},
					],
				},
			],
		},
		{
			id: "production",
			label: "Production",
			icon: "Camera",
			defaultPath: url("/bookings"),
			sections: [
				{
					id: "production-pipeline",
					label: "Production",
					items: [
						{
							id: "bookings",
							label: "Bookings",
							path: url("/bookings"),
							icon: "CalendarDays",
							permission: { any: [{ resource: "booking", action: "list" }] },
						},
						{
							id: "shoots",
							label: "Shoots",
							path: url("/shoots"),
							icon: "Camera",
							permission: { any: [{ resource: "shoot", action: "list" }] },
						},
					],
				},
			],
		},
		{
			id: "operations",
			label: "Operations",
			icon: "ListTodo",
			defaultPath: url("/deliverables"),
			sections: [
				{
					id: "operations-core",
					label: "Operations",
					items: [
						{
							id: "deliverables",
							label: "Deliverables",
							path: url("/deliverables"),
							icon: "Package",
							permission: { any: [{ resource: "deliverable", action: "list" }] },
						},
						{
							id: "tasks",
							label: "Tasks",
							path: url("/tasks"),
							icon: "ListTodo",
							permission: { any: [{ resource: "task", action: "list" }] },
						},
						{
							id: "crew",
							label: "Crew",
							path: url("/crews"),
							icon: "Users",
							permission: { any: [{ resource: "crew", action: "list" }] },
						},
					],
				},
			],
		},
		{
			id: "finance",
			label: "Finance",
			icon: "Wallet2",
			defaultPath: url("/payments"),
			sections: [
				{
					id: "finance-core",
					label: "Finance",
					items: [
						{
							id: "payments",
							label: "Payments",
							path: url("/payments"),
							icon: "Wallet2",
							permission: { any: [{ resource: "payment", action: "list" }] },
						},
						{
							id: "expenses",
							label: "Expenses",
							path: url("/expenses"),
							icon: "Banknote",
							permission: { any: [{ resource: "expense", action: "list" }] },
						},
					],
				},
			],
		},
		{
			id: "crm",
			label: "CRM",
			icon: "Contact2",
			defaultPath: url("/clients"),
			sections: [
				{
					id: "crm-core",
					label: "CRM",
					items: [
						{
							id: "clients",
							label: "Clients",
							path: url("/clients"),
							icon: "Contact2",
							permission: { any: [{ resource: "client", action: "list" }] },
						},
					],
				},
			],
		},
		{
			id: "system",
			label: "System",
			icon: "Settings2",
			defaultPath: url("/configurations"),
			sections: [
				{
					id: "system-core",
					label: "System",
					items: [
						{
							id: "configurations",
							label: "Configurations",
							path: url("/configurations"),
							icon: "Settings2",
							permission: {
								any: [{ resource: "configuration", action: "list" }],
							},
						},
					],
				},
			],
		},
	];

	const utilities: NavItemConfig[] = [
		{
			id: "settings",
			label: "Settings",
			path: url("/settings"),
			icon: "Settings",
		},
	];

	return { modules, utilities };
}
