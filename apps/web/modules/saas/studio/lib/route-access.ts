import { getNavigationConfig } from "./navigation/config";
import type { NavItemConfig, NavPermissionCheck } from "./navigation/types";

function flattenNavItems(items: NavItemConfig[]): NavItemConfig[] {
	return items.flatMap((item) => [
		item,
		...(item.children ? flattenNavItems(item.children) : []),
	]);
}

function getAllNavigationItems(organizationSlug: string): NavItemConfig[] {
	const navigationConfig = getNavigationConfig(organizationSlug);
	const moduleItems = navigationConfig.modules.flatMap((navModule) =>
		navModule.sections.flatMap((section) => flattenNavItems(section.items)),
	);
	const utilityItems = flattenNavItems(navigationConfig.utilities);
	const areaItems = Object.values(navigationConfig.areas).flatMap((area) => [
		...area.sections.flatMap((section) => flattenNavItems(section.items)),
		...flattenNavItems(area.standaloneItems ?? []),
	]);

	return [...moduleItems, ...utilityItems, ...areaItems];
}

function matchesRoutePath(routePath: string, candidatePath: string): boolean {
	return (
		routePath === candidatePath ||
		routePath.startsWith(`${candidatePath}/`) ||
		routePath.startsWith(`${candidatePath}?`)
	);
}

export function buildStudioRoutePath(
	organizationSlug: string,
	routeSuffix: string,
): string {
	return `/app/${organizationSlug}${routeSuffix}`;
}

export function getStudioRoutePermission(
	organizationSlug: string,
	routePath: string,
): NavPermissionCheck | undefined {
	const navigationItems = getAllNavigationItems(organizationSlug);

	return navigationItems
		.filter((item) => matchesRoutePath(routePath, item.path))
		.sort((left, right) => right.path.length - left.path.length)[0]
		?.permission;
}
