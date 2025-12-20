import {
	BarChart3Icon,
	FileTextIcon,
	GlobeIcon,
	HeadphonesIcon,
	ImageIcon,
} from "lucide-react";
import type { Announcement, AppDefinition } from "./types";

export const ANNOUNCEMENTS: Announcement[] = [
	{
		id: "1",
		type: "feature",
		title: "New Hub Experience",
		description:
			"A new home for all your organizations, apps, and updates in one place.",
		date: "2025-12-20",
	},
	{
		id: "2",
		type: "update",
		title: "Improved Team Management",
		description:
			"Invite team members faster with bulk invitations and role templates.",
		date: "2025-12-18",
	},
	{
		id: "3",
		type: "fix",
		title: "Performance Improvements",
		description:
			"Optimized page load times and reduced memory usage across the app.",
		date: "2025-12-15",
	},
];

export const APPS: AppDefinition[] = [
	{
		id: "forms",
		name: "Forms",
		description: "Create and manage forms, surveys, and collect responses",
		icon: FileTextIcon,
		status: "coming_soon",
	},
	{
		id: "gallery",
		name: "Gallery",
		description: "Media and asset management for your organization",
		icon: ImageIcon,
		status: "coming_soon",
	},
	{
		id: "website",
		name: "Website",
		description: "Build and publish websites for your organization",
		icon: GlobeIcon,
		status: "coming_soon",
	},
	{
		id: "support",
		name: "Support",
		description: "Customer support ticketing and help desk",
		icon: HeadphonesIcon,
		status: "coming_soon",
	},
	{
		id: "analytics",
		name: "Analytics",
		description: "Track and analyze your organization's performance",
		icon: BarChart3Icon,
		status: "coming_soon",
	},
];
