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
	Users,
	Wallet,
} from "lucide-react";
import type { IconName, IconRegistry } from "./types";

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
	helpCircle: HelpCircle,
	clipboardCheck: ClipboardCheck,
	building: Building,
};

export function getIcon(name: IconName) {
	return iconRegistry[name];
}
