import { roleHasPermission } from "@repo/api/modules/studio/lib/roles";
import type {
	NavItemConfig,
	NavigationConfig,
	NavModuleConfig,
	NavPermissionCheck,
} from "./types";

/**
 * Check if a user with the given role has the required permission.
 * - If no permission is defined, the item is always visible.
 * - If `any` is defined, user needs at least ONE of those permissions.
 * - If `all` is defined, user needs ALL of those permissions.
 */
function hasPermission(
	permission: NavPermissionCheck | undefined,
	userRole: string,
): boolean {
	if (!permission) {
		return true;
	}

	// Check "any" permissions (OR logic)
	if (permission.any && permission.any.length > 0) {
		const hasAny = permission.any.some(({ resource, action }) =>
			roleHasPermission(userRole, resource, action),
		);
		if (hasAny) {
			return true;
		}
	}

	// Check "all" permissions (AND logic)
	if (permission.all && permission.all.length > 0) {
		const hasAll = permission.all.every(({ resource, action }) =>
			roleHasPermission(userRole, resource, action),
		);
		if (hasAll) {
			return true;
		}
	}

	// If neither any nor all passed, deny
	// (handles case where both are defined but neither matched)
	if (permission.any || permission.all) {
		return false;
	}

	return true;
}

/**
 * Recursively filter nav items based on user role permissions.
 */
function filterNavItems(
	items: NavItemConfig[],
	userRole: string,
): NavItemConfig[] {
	const filtered: NavItemConfig[] = [];

	for (const item of items) {
		const allowed = hasPermission(item.permission, userRole);
		if (!allowed) {
			continue;
		}

		// Recursively filter children if present
		const children = item.children
			? filterNavItems(item.children, userRole)
			: undefined;

		filtered.push({ ...item, children });
	}

	return filtered;
}

/**
 * Find the first available item path in a module.
 * Used to calculate the defaultPath after filtering.
 */
function firstItemPath(navModule: NavModuleConfig): string | undefined {
	for (const section of navModule.sections) {
		for (const item of section.items) {
			if (item.path) {
				return item.path;
			}
			if (item.children && item.children.length > 0) {
				const childPath = item.children[0]?.path;
				if (childPath) {
					return childPath;
				}
			}
		}
	}
	return undefined;
}

/**
 * Filter navigation configuration based on user role.
 * Removes items the user doesn't have permission to see.
 * Removes empty sections and modules.
 * Recalculates defaultPath for modules based on remaining items.
 */
export function filterNavigationConfig(
	config: NavigationConfig,
	userRole: string,
): NavigationConfig {
	const modules: NavModuleConfig[] = [];

	for (const navModule of config.modules) {
		const sections: NavModuleConfig["sections"] = [];

		for (const section of navModule.sections) {
			const items = filterNavItems(section.items, userRole);
			if (items.length === 0) {
				continue;
			}

			sections.push({ ...section, items });
		}

		// Skip empty modules
		if (sections.length === 0) {
			continue;
		}

		const filteredModule: NavModuleConfig = {
			...navModule,
			sections,
		};

		// Recalculate defaultPath to first available item
		const fallbackPath = firstItemPath(filteredModule);
		if (fallbackPath) {
			filteredModule.defaultPath = fallbackPath;
		}

		modules.push(filteredModule);
	}

	const utilities = filterNavItems(config.utilities, userRole);

	return {
		...config,
		modules,
		utilities,
	};
}
