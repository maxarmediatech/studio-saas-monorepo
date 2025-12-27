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
 * Flatten nav items including children (for nested navigation).
 */
function flattenNavItems(items: NavItemConfig[]): NavItemConfig[] {
	return items.flatMap((item) => {
		if (item.children && item.children.length > 0) {
			return [item, ...flattenNavItems(item.children)];
		}
		return item;
	});
}

/**
 * Check if a module matches the current pathname.
 * Matches if:
 * 1. pathname starts with module's defaultPath
 * 2. OR any section item matches the pathname
 */
function moduleMatchesPath(
	module: NavModuleConfig,
	pathname: string,
	basePath: string,
): boolean {
	const normalizedPathname = normalizePath(pathname);
	const normalizedBase = normalizePath(basePath);

	// Home/base path: only first module (overview) matches
	if (normalizedPathname === normalizedBase && module.id === "overview") {
		return true;
	}

	// Check if pathname starts with module's defaultPath
	const normalizedDefaultPath = normalizePath(module.defaultPath);
	if (
		normalizedPathname === normalizedDefaultPath ||
		normalizedPathname.startsWith(`${normalizedDefaultPath}/`)
	) {
		return true;
	}

	// Check if any section item matches
	return module.sections.some((section) =>
		flattenNavItems(section.items).some((item) => {
			const normalizedItemPath = normalizePath(item.path);
			return (
				normalizedPathname === normalizedItemPath ||
				normalizedPathname.startsWith(`${normalizedItemPath}/`)
			);
		}),
	);
}

/**
 * Find the module that matches the current pathname.
 * Returns null if no module matches (e.g., on utility pages like settings).
 *
 * Uses most-specific-match logic: modules with longer defaultPaths are
 * checked first to avoid parent paths matching child routes.
 */
export function findModuleByPath(
	pathname: string,
	config: NavigationConfig,
): NavModuleConfig | null {
	// Determine base path from first module's defaultPath
	const basePath =
		config.modules[0]?.defaultPath.replace(/\/[^/]*$/, "") ?? "/app";

	// Sort modules by defaultPath length descending (most specific first)
	// This ensures /configurations/booking-types matches before /app/{slug}
	const sortedModules = [...config.modules].sort(
		(a, b) => b.defaultPath.length - a.defaultPath.length,
	);

	// Find module matching current path
	const match = sortedModules.find((module) =>
		moduleMatchesPath(module, pathname, basePath),
	);

	return match ?? null;
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
 * Find the active module ID based on the current pathname.
 * Falls back to first module if no match found.
 */
export function findActiveModuleId(
	pathname: string,
	config: NavigationConfig,
): string {
	const navModule = findModuleByPath(pathname, config);
	return navModule?.id ?? config.modules[0]?.id ?? "overview";
}
