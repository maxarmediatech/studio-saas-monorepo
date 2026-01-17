import type { SavedViewEntityType } from "@repo/api/modules/studio/schemas/saved-view";

export type { SavedViewEntityType };

export interface SavedView {
	id: string;
	organizationId: string;
	createdBy: string | null;
	entityType: SavedViewEntityType;
	name: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	filters: Record<string, unknown>;
	displayFilters: Record<string, unknown> | null;
	columnVisibility: Record<string, boolean> | null;
	sorting: Array<{ id: string; desc: boolean }> | null;
	isSystem: boolean;
	isDefault: boolean;
	isPublic: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	isFavorite: boolean;
	createdByUser: {
		id: string;
		name: string | null;
		image: string | null;
	} | null;
}

export type LayoutType = "table" | "calendar" | "kanban";

export interface FilterConfig {
	id: string;
	label: string;
	type: "select" | "multiSelect" | "date" | "dateRange" | "text";
	options?: Array<{ value: string; label: string; icon?: React.ReactNode }>;
	icon?: React.ComponentType<{ className?: string }>;
}

export interface ActiveFilter {
	id: string;
	value: unknown;
}
