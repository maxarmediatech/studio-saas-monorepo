import type { LucideIcon } from "lucide-react";

export type OrganizationWithStats = {
	id: string;
	name: string;
	slug: string | null;
	logo: string | null | undefined;
	createdAt: Date;
	memberCount: number;
	role: "owner" | "admin" | "member";
	planName: string | null;
};

export type AnnouncementType = "feature" | "update" | "fix";

export type Announcement = {
	id: string;
	type: AnnouncementType;
	title: string;
	description: string;
	date: string;
	link?: string;
};

export type AppStatus = "available" | "coming_soon" | "installed";

export type AppDefinition = {
	id: string;
	name: string;
	description: string;
	icon: LucideIcon;
	status: AppStatus;
	href?: string;
};
