import {
	Banknote,
	Building,
	CalendarDays,
	Camera,
	ClipboardCheck,
	Contact,
	HelpCircle,
	Home,
	Inbox,
	LayoutDashboard,
	ListTodo,
	Package,
	Settings,
	SlidersHorizontal,
	Users,
	Wallet,
} from "lucide-react";
import type { IconName, IconRegistry } from "./navigation/types";

export const iconRegistry: IconRegistry = {
	home: Home,
	layoutDashboard: LayoutDashboard,
	inbox: Inbox,
	calendarDays: CalendarDays,
	camera: Camera,
	package: Package,
	listTodo: ListTodo,
	banknote: Banknote,
	wallet: Wallet,
	users: Users,
	contact: Contact,
	settings: Settings,
	slidersHorizontal: SlidersHorizontal,
	helpCircle: HelpCircle,
	clipboardCheck: ClipboardCheck,
	building: Building,
};

export function getIcon(name: IconName) {
	return iconRegistry[name];
}
