"use client";

import type { LucideIcon } from "lucide-react";
import {
	Activity,
	AlertTriangle,
	Banknote,
	Bell,
	CalendarDays,
	Camera,
	ClipboardCheck,
	Contact2,
	CreditCard,
	FileText,
	Hand,
	HelpCircle,
	Home,
	Inbox,
	LayoutDashboard,
	Link2,
	ListChecks,
	ListTodo,
	Mail,
	MessageSquare,
	MessagesSquare,
	Package,
	Plus,
	Receipt,
	Settings,
	Settings2,
	Shield,
	Sparkles,
	StickyNoteIcon,
	Store,
	Tag,
	User,
	UserCog,
	Users,
	Wallet2,
} from "lucide-react";

const registry = {
	Activity,
	AlertTriangle,
	Banknote,
	Bell,
	Store,
	CalendarDays,
	Camera,
	ClipboardCheck,
	Contact2,
	CreditCard,
	FileText,
	Hand,
	HelpCircle,
	Home,
	Inbox,
	LayoutDashboard,
	Link2,
	ListChecks,
	ListTodo,
	Mail,
	MessageSquare,
	MessagesSquare,
	Package,
	Plus,
	Receipt,
	Settings,
	Settings2,
	Shield,
	Sparkles,
	StickyNoteIcon,
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
