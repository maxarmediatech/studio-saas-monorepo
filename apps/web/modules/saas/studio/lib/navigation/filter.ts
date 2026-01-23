import {
	type CustomRolePermissions,
	checkRolePermission,
} from "@repo/auth/lib/permissions";
import type {
	NavItemConfig,
	NavigationConfig,
	NavModuleConfig,
	NavPermissionCheck,
} from "./types";

function hasPermission(
	permission: NavPermissionCheck | undefined,
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): boolean {
	if (!permission) {
		return true;
	}

	if (permission.any && permission.any.length > 0) {
		const hasAny = permission.any.some(({ resource, action }) =>
			checkRolePermission(
				userRole,
				resource as never,
				action as never,
				customRolePermissions,
			),
		);
		if (hasAny) {
			return true;
		}
	}

	if (permission.all && permission.all.length > 0) {
		const hasAll = permission.all.every(({ resource, action }) =>
			checkRolePermission(
				userRole,
				resource as never,
				action as never,
				customRolePermissions,
			),
		);
		if (hasAll) {
			return true;
		}
	}

	if (permission.any || permission.all) {
		return false;
	}

	return true;
}

function filterNavItems(
	items: NavItemConfig[],
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): NavItemConfig[] {
	const filtered: NavItemConfig[] = [];

	for (const item of items) {
		const allowed = hasPermission(
			item.permission,
			userRole,
			customRolePermissions,
		);
		if (!allowed) {
			continue;
		}

		const children = item.children
			? filterNavItems(item.children, userRole, customRolePermissions)
			: undefined;

		filtered.push({ ...item, children });
	}

	return filtered;
}

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

export function filterNavigationConfig(
	config: NavigationConfig,
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): NavigationConfig {
	const modules: NavModuleConfig[] = [];

	for (const navModule of config.modules) {
		const sections: NavModuleConfig["sections"] = [];

		for (const section of navModule.sections) {
			const items = filterNavItems(
				section.items,
				userRole,
				customRolePermissions,
			);
			if (items.length === 0) {
				continue;
			}

			sections.push({ ...section, items });
		}

		if (sections.length === 0) {
			continue;
		}

		const filteredModule: NavModuleConfig = {
			...navModule,
			sections,
		};

		const fallbackPath = firstItemPath(filteredModule);
		if (fallbackPath) {
			filteredModule.defaultPath = fallbackPath;
		}

		modules.push(filteredModule);
	}

	const utilities = filterNavItems(
		config.utilities,
		userRole,
		customRolePermissions,
	);

	return {
		...config,
		modules,
		utilities,
	};
}
