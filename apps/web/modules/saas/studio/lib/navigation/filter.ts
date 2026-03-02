import type { CustomRolePermissions } from "@repo/auth/lib/permissions";
import type {
	NavItemConfig,
	NavAreaConfig,
	NavigationConfig,
	NavModuleConfig,
} from "./types";
import { matchesNavPermission } from "./access";

function filterNavItems(
	items: NavItemConfig[],
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): NavItemConfig[] {
	const filtered: NavItemConfig[] = [];

	for (const item of items) {
		const allowed = matchesNavPermission(
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

function filterNavArea(
	area: NavAreaConfig,
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): NavAreaConfig {
	const sections = area.sections
		.map((section) => ({
			...section,
			items: filterNavItems(
				section.items,
				userRole,
				customRolePermissions,
			),
		}))
		.filter((section) => section.items.length > 0);

	const standaloneItems = area.standaloneItems
		? filterNavItems(area.standaloneItems, userRole, customRolePermissions)
		: undefined;

	if (
		area.sections.length === 0 &&
		(area.standaloneItems?.length ?? 0) === 0
	) {
		return area;
	}

	return {
		...area,
		sections,
		standaloneItems,
	};
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

	const areas = Object.fromEntries(
		Object.entries(config.areas).map(([areaKey, area]) => [
			areaKey,
			filterNavArea(area, userRole, customRolePermissions),
		]),
	);

	return {
		...config,
		modules,
		utilities,
		areas,
	};
}
