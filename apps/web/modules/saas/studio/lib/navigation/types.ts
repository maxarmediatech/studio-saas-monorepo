import type { AnyAction, Resource } from "@repo/auth/lib/permissions";
import type { LucideIcon } from "lucide-react";

// ============================================================================
// ICON TYPES
// ============================================================================

export type IconName =
	| "Activity"
	| "AlertTriangle"
	| "Banknote"
	| "Bell"
	| "CalendarDays"
	| "Camera"
	| "ClipboardCheck"
	| "Contact2"
	| "CreditCard"
	| "FileText"
	| "Hand"
	| "HelpCircle"
	| "Home"
	| "Inbox"
	| "LayoutDashboard"
	| "Link2"
	| "ListChecks"
	| "ListTodo"
	| "Mail"
	| "MessageSquare"
	| "MessagesSquare"
	| "Package"
	| "Receipt"
	| "Settings"
	| "Settings2"
	| "Shield"
	| "Sparkles"
	| "StickyNoteIcon"
	| "Store"
	| "Tag"
	| "User"
	| "UserCog"
	| "Plus"
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
	rolesAny?: readonly string[];
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
	expanded?: boolean;
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
	id: string;
	kind: "module" | "area";
	icon: IconName;
	label: string; // Tooltip text
	href: string;
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
	standaloneItems?: NavItemConfig[]; // Items rendered individually (no tab group)
}

// ============================================================================
// ROOT NAVIGATION CONFIG
// ============================================================================

export interface NavigationConfig {
	modules: NavModuleConfig[];
	utilities: NavItemConfig[];
	areas: Record<string, NavAreaConfig>; // Named areas (e.g., "studioSettings")
}
