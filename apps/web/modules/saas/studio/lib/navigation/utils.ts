import type {
	NavItemConfig,
	NavModuleConfig,
	NavigationConfig,
} from "./types";

/**
 * Normalize pathname by removing trailing slash for consistent comparison.
 */
function normalizePath(path: string): string {
	return path.replace(/\/$/, "") || "/";
}

/**
 * Check if a pathname matches a nav item path.
 * - For base/home paths: exact match only (prevents false positives)
 * - For other paths: exact match OR nested route match
 */
export function isItemActive(
	pathname: string,
	itemPath: string,
	basePath: string,
): boolean {
	const normalizedPathname = normalizePath(pathname);
	const normalizedItemPath = normalizePath(itemPath);
	const normalizedBase = normalizePath(basePath);

	// Home/base path: exact match only to prevent collision with all routes
	if (normalizedItemPath === normalizedBase) {
		return normalizedPathname === normalizedBase;
	}

	// Other paths: exact match OR is a nested route
	return (
		normalizedPathname === normalizedItemPath ||
		normalizedPathname.startsWith(`${normalizedItemPath}/`)
	);
}

/**
 * Get all nav items from a module (flattened from all sections).
 */
function getModuleItems(navModule: NavModuleConfig): NavItemConfig[] {
	return navModule.sections.flatMap((section) => section.items);
}

/**
 * Find which nav item (if any) matches the current pathname.
 * Returns the most specific match (longest path first).
 */
function findActiveNavItem(
	items: NavItemConfig[],
	pathname: string,
	basePath: string,
): NavItemConfig | null {
	// Sort by path length descending for most specific match first
	const sortedItems = [...items].sort(
		(a, b) => b.path.length - a.path.length,
	);

	for (const item of sortedItems) {
		if (isItemActive(pathname, item.path, basePath)) {
			return item;
		}
	}
	return null;
}

/**
 * Find the module that contains a nav item matching the current pathname.
 * Returns null if no module matches (e.g., on utility pages like settings).
 */
export function findModuleByPath(
	pathname: string,
	config: NavigationConfig,
): NavModuleConfig | null {
	// Determine base path from first module's defaultPath
	const basePath =
		config.modules[0]?.defaultPath.replace(/\/[^/]*$/, "") ?? "/app";

	const normalizedPathname = normalizePath(pathname);
	const normalizedBase = normalizePath(basePath);

	// Home page belongs to first module
	if (normalizedPathname === normalizedBase) {
		return config.modules[0] ?? null;
	}

	// Find module by matching any of its items
	for (const navModule of config.modules) {
		const items = getModuleItems(navModule);
		if (findActiveNavItem(items, pathname, basePath)) {
			return navModule;
		}
	}

	return null;
}

/**
 * Find the active module ID based on the current pathname.
 * Falls back to first module if no match found.
 */
export function findActiveModuleId(
	pathname: string,
	config: NavigationConfig,
): string {
	const navModule = findModuleByPath(pathname, config);
	return navModule?.id ?? config.modules[0]?.id ?? "studio";
}
