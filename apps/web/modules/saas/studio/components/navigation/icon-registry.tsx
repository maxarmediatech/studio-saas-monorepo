"use client";

import type { LucideIcon } from "lucide-react";
import {
	Banknote,
	Bell,
	CalendarDays,
	Camera,
	ClipboardCheck,
	Contact2,
	CreditCard,
	HelpCircle,
	Home,
	Inbox,
	LayoutDashboard,
	Link2,
	ListChecks,
	ListTodo,
	Package,
	Settings,
	Settings2,
	Shield,
	Sparkles,
	Tag,
	User,
	UserCog,
	Users,
	Wallet2,
} from "lucide-react";

const registry = {
	Banknote,
	Bell,
	CalendarDays,
	Camera,
	ClipboardCheck,
	Contact2,
	CreditCard,
	HelpCircle,
	Home,
	Inbox,
	LayoutDashboard,
	Link2,
	ListChecks,
	ListTodo,
	Package,
	Settings,
	Settings2,
	Shield,
	Sparkles,
	Tag,
	User,
	UserCog,
	Users,
	Wallet2,
} satisfies Record<string, LucideIcon>;

export function IconByName({
	name,
	className,
}: {
	name?: string;
	className?: string;
}) {
	if (!name) {
		return null;
	}
	const Icon = registry[name as keyof typeof registry];
	if (!Icon) {
		return null;
	}
	return <Icon className={className} />;
}

export type IconName = keyof typeof registry;
