import type { CustomRolePermissions } from "@repo/auth/lib/permissions";
import { matchesNavPermission } from "@saas/studio/lib/navigation/access";
import type { NavPermissionCheck } from "@saas/studio/lib/navigation/types";

export type SettingsRouteKey =
	| "general"
	| "studioDangerZone"
	| "profile"
	| "security"
	| "accountDangerZone"
	| "people"
	| "members"
	| "invitations"
	| "teams"
	| "roles"
	| "billing"
	| "integrations"
	| "notifications";

export interface SettingsTabItem {
	key: SettingsRouteKey;
	label: string;
	href: string;
}

export interface SettingsStandaloneTab {
	label: string;
	href: string;
	searchParamKey?: string;
	searchParamValue?: string;
}

export interface SettingsTabGroup {
	id: string;
	label: string;
	tabs: SettingsTabItem[];
}

export interface SettingsStandalonePage {
	key: SettingsRouteKey;
	label: string;
	href: string;
	tabs?: SettingsStandaloneTab[];
}

const SETTINGS_ADMIN_ROLES = ["owner", "admin"] as const;

const settingsReadAccess: NavPermissionCheck = {
	any: [
		{ resource: "settings", action: "read" },
		{ resource: "settings", action: "update" },
	],
};

export const settingsRouteAccess: Record<
	SettingsRouteKey,
	NavPermissionCheck | undefined
> = {
	general: settingsReadAccess,
	studioDangerZone: {
		rolesAny: SETTINGS_ADMIN_ROLES,
	},
	profile: undefined,
	security: undefined,
	accountDangerZone: undefined,
	people: {
		rolesAny: SETTINGS_ADMIN_ROLES,
	},
	members: {
		rolesAny: SETTINGS_ADMIN_ROLES,
	},
	invitations: {
		rolesAny: SETTINGS_ADMIN_ROLES,
	},
	teams: {
		rolesAny: SETTINGS_ADMIN_ROLES,
	},
	roles: {
		rolesAny: SETTINGS_ADMIN_ROLES,
	},
	billing: settingsReadAccess,
	integrations: settingsReadAccess,
	notifications: settingsReadAccess,
};

export function canAccessSettingsRoute(
	key: SettingsRouteKey,
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): boolean {
	return matchesNavPermission(
		settingsRouteAccess[key],
		userRole,
		customRolePermissions,
	);
}

export function getSettingsTabGroups(basePath: string): SettingsTabGroup[] {
	return [
		{
			id: "studio",
			label: "Studio",
			tabs: [
				{ key: "general", label: "General", href: `${basePath}` },
				{
					key: "studioDangerZone",
					label: "Danger Zone",
					href: `${basePath}/danger-zone`,
				},
			],
		},
		{
			id: "account",
			label: "Account",
			tabs: [
				{
					key: "profile",
					label: "Profile",
					href: `${basePath}/profile`,
				},
				{
					key: "security",
					label: "Security",
					href: `${basePath}/security`,
				},
				{
					key: "accountDangerZone",
					label: "Danger Zone",
					href: `${basePath}/account/danger-zone`,
				},
			],
		},
	];
}

export function getSettingsStandalonePages(
	basePath: string,
): SettingsStandalonePage[] {
	return [
		{
			key: "people",
			label: "People",
			href: `${basePath}/people`,
			tabs: [
				{ label: "All", href: `${basePath}/people` },
				{
					label: "Members",
					href: `${basePath}/people?workerType=internal`,
					searchParamKey: "workerType",
					searchParamValue: "internal",
				},
				{
					label: "Contractual",
					href: `${basePath}/people?workerType=freelancer`,
					searchParamKey: "workerType",
					searchParamValue: "freelancer",
				},
			],
		},
		{
			key: "invitations",
			label: "Invitations",
			href: `${basePath}/invitations`,
		},
		{ key: "teams", label: "Teams", href: `${basePath}/teams` },
		{ key: "roles", label: "Access Control", href: `${basePath}/roles` },
		{
			key: "integrations",
			label: "Integrations",
			href: `${basePath}/integrations`,
		},
		{ key: "billing", label: "Billing", href: `${basePath}/billing` },
		{
			key: "notifications",
			label: "Notifications",
			href: `${basePath}/notifications`,
		},
	];
}

export function getVisibleSettingsTabGroups(
	basePath: string,
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): SettingsTabGroup[] {
	return getSettingsTabGroups(basePath)
		.map((group) => ({
			...group,
			tabs: group.tabs.filter((tab) =>
				canAccessSettingsRoute(
					tab.key,
					userRole,
					customRolePermissions,
				),
			),
		}))
		.filter((group) => group.tabs.length > 0);
}

export function getVisibleSettingsStandalonePages(
	basePath: string,
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): SettingsStandalonePage[] {
	return getSettingsStandalonePages(basePath).filter((page) =>
		canAccessSettingsRoute(page.key, userRole, customRolePermissions),
	);
}
