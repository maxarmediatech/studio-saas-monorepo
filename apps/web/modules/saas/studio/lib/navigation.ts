import type { NavModule, NavItem, SidebarData } from "./types";

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
			id: "overview",
			label: "Overview",
			icon: "layoutDashboard",
			sections: [
				{
					label: null,
					items: [{ title: "Home", url: url(""), icon: "home" }],
				},
				{
					label: "Workspace",
					items: [
						{ title: "Dashboard", url: url("/dashboard"), icon: "layoutDashboard" },
						{ title: "Inbox", url: url("/inbox"), icon: "inbox" },
					],
				},
			],
		},
		{
			id: "clients",
			label: "Clients",
			icon: "contact",
			sections: [
				{
					label: "CRM",
					items: [
						{ title: "Clients", url: url("/clients"), icon: "contact" },
						{ title: "Bookings", url: url("/bookings"), icon: "calendarDays" },
					],
				},
			],
		},
		{
			id: "production",
			label: "Production",
			icon: "camera",
			sections: [
				{
					label: "Pipeline",
					items: [
						{ title: "Shoots", url: url("/shoots"), icon: "camera" },
						{ title: "Tasks", url: url("/tasks"), icon: "listTodo" },
					],
				},
				{
					label: "Team",
					items: [{ title: "Crew", url: url("/crews"), icon: "users" }],
				},
			],
		},
		{
			id: "deliverables",
			label: "Deliverables",
			icon: "package",
			sections: [
				{
					label: "Galleries",
					items: [
						{ title: "All Galleries", url: url("/galleries"), icon: "package" },
					],
				},
			],
		},
		{
			id: "finance",
			label: "Finance",
			icon: "wallet",
			sections: [
				{
					label: "Billing",
					items: [
						{ title: "Expenses", url: url("/expenses"), icon: "banknote" },
						{ title: "Payments", url: url("/payments"), icon: "wallet" },
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
		return "overview";
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

	// Default to overview
	return "overview";
}

type ModuleId = NavModule["id"];
