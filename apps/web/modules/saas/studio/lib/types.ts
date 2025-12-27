import type { LucideIcon } from "lucide-react";

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

export type NavItem = {
	title: string;
	url: string;
	icon: IconName;
	badge?: string | number;
	items?: NavItem[];
};

export type NavSection = {
	label: string | null;
	items: NavItem[];
};

export type ModuleId =
	| "studio"
	| "configurations";

export type NavModule = {
	id: ModuleId;
	label: string;
	icon: IconName;
	sections: NavSection[];
};

export type SidebarData = {
	modules: NavModule[];
	utilities: NavItem[];
};

export type IconRegistry = Record<IconName, LucideIcon>;
