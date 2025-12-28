import type { LucideIcon } from "lucide-react";
import type {
	AnyAction,
	Resource,
} from "@repo/api/modules/studio/lib/roles";

// ============================================================================
// ICON TYPES
// ============================================================================

export type IconName =
	| "Banknote"
	| "Bell"
	| "CalendarDays"
	| "Camera"
	| "ClipboardCheck"
	| "Contact2"
	| "CreditCard"
	| "HelpCircle"
	| "Home"
	| "Inbox"
	| "LayoutDashboard"
	| "ListChecks"
	| "ListTodo"
	| "Package"
	| "Settings"
	| "Settings2"
	| "Shield"
	| "User"
	| "Users"
	| "Wallet2";

export type IconRegistry = Record<IconName, LucideIcon>;

// ============================================================================
// NAVIGATION INTENT
// ============================================================================

export type NavIntent = "primary" | "secondary" | "utility";

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
	intent?: NavIntent;
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

// ============================================================================
// RAIL ICON CONFIG (for Dub-style sidebar)
// ============================================================================

export interface RailIconConfig {
	moduleId: string;
	icon: IconName;
	label: string; // Tooltip text
	defaultPath: string;
}

// ============================================================================
// AREA CONFIG (for Dub-style settings areas)
// ============================================================================

/**
 * Configuration for a sidebar area (like Dub's workspaceSettings).
 * Areas are separate sidebar panels that slide in based on pathname.
 */
export interface NavAreaConfig {
	id: string;
	title: string;
	backHref?: string; // If provided, show back button that navigates here
	direction?: "left" | "right"; // Slide animation direction (default: right)
	sections: NavSectionConfig[];
}

// ============================================================================
// ROOT NAVIGATION CONFIG
// ============================================================================

export interface NavigationConfig {
	modules: NavModuleConfig[];
	utilities: NavItemConfig[];
	areas: Record<string, NavAreaConfig>; // Named areas (e.g., "studioSettings")
}
