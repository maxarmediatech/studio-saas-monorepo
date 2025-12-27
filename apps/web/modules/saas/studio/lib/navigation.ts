import type { NavItem, NavModule, SidebarData } from "./types";

/**
 * Build the URL for a navigation item, prefixed with the studio base path
 */
export function buildUrl(studioSlug: string, path: string): string {
	return `/app/${studioSlug}${path}`;
}

/**
 * Get sidebar navigation data for a studio
 * URLs are built dynamically based on the studio slug
 */
export function getSidebarData(studioSlug: string): SidebarData {
	const url = (path: string) => buildUrl(studioSlug, path);

	const modules: NavModule[] = [
		{
			id: "studio",
			label: "Studio",
			icon: "building",
			sections: [
				{
					label: null,
					items: [
						{ title: "Home", url: url(""), icon: "home" },
						{
							title: "Dashboard",
							url: url("/dashboard"),
							icon: "layoutDashboard",
						},
					],
				},
				{
					label: "Operations",
					items: [
						{
							title: "Bookings",
							url: url("/bookings"),
							icon: "calendarDays",
						},
						{
							title: "Shoots",
							url: url("/shoots"),
							icon: "camera",
						},

						{
							title: "Deliverables",
							url: url("/deliverables"),
							icon: "package",
						},
						{
							title: "Tasks",
							url: url("/tasks"),
							icon: "listTodo",
						},
					],
				},
				{
					label: "Finance",
					items: [
						{
							title: "Payments",
							url: url("/payments"),
							icon: "wallet",
						},
						{
							title: "Expenses",
							url: url("/expenses"),
							icon: "banknote",
						},
					],
				},
				{
					label: "People",
					items: [
						{
							title: "Clients",
							url: url("/clients"),
							icon: "contact",
						},
						{ title: "Crew", url: url("/crews"), icon: "users" },
					],
				},
			],
		},
		{
			id: "configurations",
			label: "Configurations",
			icon: "slidersHorizontal",
			sections: [
				{
					label: "Configs",
					items: [
						{
							title: "Booking Types",
							url: url("/configurations/booking-types"),
							icon: "calendarDays",
						},
						{
							title: "Package Types",
							url: url("/configurations/package-types"),
							icon: "package",
						},
						{
							title: "Relation Types",
							url: url("/configurations/relation-types"),
							icon: "contact",
						},
						{
							title: "Crew Roles",
							url: url("/configurations/crew-roles"),
							icon: "users",
						},
					],
				},
			],
		},
	];

	const utilities: NavItem[] = [
		{ title: "Settings", url: url("/settings"), icon: "settings" },
	];

	return { modules, utilities };
}

/**
 * Find the active module based on the current pathname
 */
export function findActiveModule(
	modules: NavModule[],
	pathname: string,
	studioSlug: string,
): ModuleId {
	const basePath = `/app/${studioSlug}`;

	// Check if we're on the home page
	if (pathname === basePath || pathname === `${basePath}/`) {
		return "studio";
	}

	// Find module by matching any of its section items
	for (const module of modules) {
		for (const section of module.sections) {
			for (const item of section.items) {
				if (pathname.startsWith(item.url) && item.url !== basePath) {
					return module.id;
				}
			}
		}
	}

	// Default to studio
	return "studio";
}

type ModuleId = NavModule["id"];
