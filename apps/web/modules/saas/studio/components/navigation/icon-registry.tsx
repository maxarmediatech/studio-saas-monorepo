"use client";

import type { LucideIcon } from "lucide-react";
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

const registry: Record<string, LucideIcon> = {
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

export function IconByName({
	name,
	className,
}: {
	name?: string;
	className?: string;
}) {
	if (!name) return null;
	const Icon = registry[name];
	if (!Icon) return null;
	return <Icon className={className} />;
}
