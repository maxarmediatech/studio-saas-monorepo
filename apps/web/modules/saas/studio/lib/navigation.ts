import type { ModuleId, NavItem, NavModule, SidebarData } from "./types";

/**
 * Build the URL for a navigation item, prefixed with the studio base path
 */
export function buildUrl(studioSlug: string, path: string): string {
	return `/app/${studioSlug}${path}`;
}

/**
 * Normalize pathname by removing trailing slash for consistent comparison
 */
function normalizePath(path: string): string {
	return path.replace(/\/$/, "") || "/";
}

/**
 * Check if a pathname matches a nav item URL.
 * - For base/home paths (e.g., /app/slug): exact match only
 * - For other paths: exact match OR nested route match
 */
export function isPathActive(
	pathname: string,
	itemUrl: string,
	basePath: string,
): boolean {
	const normalizedPathname = normalizePath(pathname);
	const normalizedUrl = normalizePath(itemUrl);
	const normalizedBase = normalizePath(basePath);

	// Home/base path: exact match only to prevent collision with all routes
	if (normalizedUrl === normalizedBase) {
		return normalizedPathname === normalizedBase;
	}

	// Other paths: exact match OR is a nested route
	return (
		normalizedPathname === normalizedUrl ||
		normalizedPathname.startsWith(`${normalizedUrl}/`)
	);
}

/**
 * Find which nav item (if any) matches the current pathname
 */
export function findActiveNavItem(
	items: NavItem[],
	pathname: string,
	basePath: string,
): NavItem | null {
	// Sort by URL length descending for most specific match first
	const sortedItems = [...items].sort((a, b) => b.url.length - a.url.length);

	for (const item of sortedItems) {
		if (isPathActive(pathname, item.url, basePath)) {
			return item;
		}
	}
	return null;
}

/**
 * Get all nav items from a module (flattened from all sections)
 */
export function getModuleItems(module: NavModule): NavItem[] {
	return module.sections.flatMap((section) => section.items);
}

/**
 * Find the module that owns the current pathname.
 * Returns null if no module matches (e.g., on settings page).
 */
export function findModuleByPathname(
	modules: NavModule[],
	pathname: string,
	basePath: string,
): NavModule | null {
	const normalizedPathname = normalizePath(pathname);
	const normalizedBase = normalizePath(basePath);

	// Home page belongs to first module (studio)
	if (normalizedPathname === normalizedBase) {
		return modules[0] ?? null;
	}

	// Find module by matching any of its items
	for (const module of modules) {
		const items = getModuleItems(module);
		if (findActiveNavItem(items, pathname, basePath)) {
			return module;
		}
	}

	return null;
}

/**
 * Find the active module ID based on the current pathname.
 * Falls back to first module if no match found.
 */
export function findActiveModuleId(
	modules: NavModule[],
	pathname: string,
	studioSlug: string,
): ModuleId {
	const basePath = `/app/${studioSlug}`;
	const module = findModuleByPathname(modules, pathname, basePath);
	return module?.id ?? modules[0]?.id ?? "studio";
}

/**
 * Check if the current pathname belongs to utilities (e.g., Settings)
 */
export function isUtilityPath(
	utilities: NavItem[],
	pathname: string,
	basePath: string,
): boolean {
	return findActiveNavItem(utilities, pathname, basePath) !== null;
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

// Re-export for backwards compatibility during migration
export const findActiveModule = findActiveModuleId;
