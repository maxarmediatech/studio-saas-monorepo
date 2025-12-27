import type { LucideIcon } from "lucide-react";
import type {
	AnyAction,
	Resource,
} from "@repo/api/modules/studio/lib/roles";

// ============================================================================
// ICON TYPES
// ============================================================================

export type IconName =
	| "home"
	| "layoutDashboard"
	| "inbox"
	| "calendarDays"
	| "camera"
	| "package"
	| "listTodo"
	| "banknote"
	| "wallet"
	| "users"
	| "contact"
	| "settings"
	| "slidersHorizontal"
	| "helpCircle"
	| "clipboardCheck"
	| "building";

export type IconRegistry = Record<IconName, LucideIcon>;

// ============================================================================
// PERMISSION TYPES
// ============================================================================

/**
 * A single permission check (resource + action pair)
 */
export interface NavPermission {
	resource: Resource;
	action: AnyAction;
}

/**
 * Permission check configuration for a nav item.
 * - `any`: User needs at least ONE of these permissions (OR logic)
 * - `all`: User needs ALL of these permissions (AND logic)
 */
export interface NavPermissionCheck {
	any?: NavPermission[];
	all?: NavPermission[];
}

// ============================================================================
// NAVIGATION ITEM TYPES
// ============================================================================

export interface NavItemConfig {
	id: string;
	label: string;
	path: string;
	icon?: IconName;
	permission?: NavPermissionCheck;
	children?: NavItemConfig[];
}

export interface NavSectionConfig {
	id: string;
	label?: string;
	items: NavItemConfig[];
}

export interface NavModuleConfig {
	id: string;
	label: string;
	icon: IconName;
	defaultPath: string;
	sections: NavSectionConfig[];
}

export interface NavigationConfig {
	modules: NavModuleConfig[];
	utilities: NavItemConfig[];
}
