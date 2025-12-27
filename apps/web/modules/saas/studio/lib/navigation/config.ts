import type {
	NavItemConfig,
	NavModuleConfig,
	NavSectionConfig,
	NavigationConfig,
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
 */
export function getNavigationConfig(studioSlug: string): NavigationConfig {
	const url = (path: string) => buildUrl(studioSlug, path);

	const modules: NavModuleConfig[] = [
		{
			id: "studio",
			label: "Studio",
			icon: "building",
			defaultPath: url(""),
			sections: [
				{
					id: "core",
					items: [
						{
							id: "home",
							label: "Home",
							path: url(""),
							icon: "home",
							// No permission - always visible
						},
						{
							id: "dashboard",
							label: "Dashboard",
							path: url("/dashboard"),
							icon: "layoutDashboard",
							permission: { any: [{ resource: "dashboard", action: "read" }] },
						},
					],
				},
				{
					id: "operations",
					label: "Operations",
					items: [
						{
							id: "bookings",
							label: "Bookings",
							path: url("/bookings"),
							icon: "calendarDays",
							permission: { any: [{ resource: "booking", action: "list" }] },
						},
						{
							id: "shoots",
							label: "Shoots",
							path: url("/shoots"),
							icon: "camera",
							permission: { any: [{ resource: "shoot", action: "list" }] },
						},
						{
							id: "deliverables",
							label: "Deliverables",
							path: url("/deliverables"),
							icon: "package",
							permission: { any: [{ resource: "deliverable", action: "list" }] },
						},
						{
							id: "tasks",
							label: "Tasks",
							path: url("/tasks"),
							icon: "listTodo",
							permission: { any: [{ resource: "task", action: "list" }] },
						},
					],
				},
				{
					id: "finance",
					label: "Finance",
					items: [
						{
							id: "payments",
							label: "Payments",
							path: url("/payments"),
							icon: "wallet",
							permission: { any: [{ resource: "payment", action: "list" }] },
						},
						{
							id: "expenses",
							label: "Expenses",
							path: url("/expenses"),
							icon: "banknote",
							permission: { any: [{ resource: "expense", action: "list" }] },
						},
					],
				},
				{
					id: "people",
					label: "People",
					items: [
						{
							id: "clients",
							label: "Clients",
							path: url("/clients"),
							icon: "contact",
							permission: { any: [{ resource: "client", action: "list" }] },
						},
						{
							id: "crew",
							label: "Crew",
							path: url("/crews"),
							icon: "users",
							permission: { any: [{ resource: "crew", action: "list" }] },
						},
					],
				},
			],
		},
		{
			id: "configurations",
			label: "Configurations",
			icon: "slidersHorizontal",
			defaultPath: url("/configurations/booking-types"),
			sections: [
				{
					id: "configs",
					label: "Configs",
					items: [
						{
							id: "booking-types",
							label: "Booking Types",
							path: url("/configurations/booking-types"),
							icon: "calendarDays",
							permission: {
								any: [{ resource: "configuration", action: "list" }],
							},
						},
						{
							id: "package-types",
							label: "Package Types",
							path: url("/configurations/package-types"),
							icon: "package",
							permission: {
								any: [{ resource: "configuration", action: "list" }],
							},
						},
						{
							id: "relation-types",
							label: "Relation Types",
							path: url("/configurations/relation-types"),
							icon: "contact",
							permission: {
								any: [{ resource: "configuration", action: "list" }],
							},
						},
						{
							id: "crew-roles",
							label: "Crew Roles",
							path: url("/configurations/crew-roles"),
							icon: "users",
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
			icon: "settings",
			permission: { any: [{ resource: "settings", action: "read" }] },
		},
	];

	return { modules, utilities };
}
