"use client";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { PlusIcon, XIcon } from "lucide-react";
import { useMemo } from "react";
import { DynamicIcon } from "./DynamicIcon";
import type { SavedView } from "./types";

interface ViewTabsBarProps {
	views: SavedView[];
	openViewIds: string[];
	activeViewId: string | null;
	onViewSelect: (view: SavedView) => void;
	onCloseTab: (viewId: string) => void;
	onCreateView: () => void;
	allTabLabel?: string;
	onAllTabClick?: () => void;
	className?: string;
}

export function ViewTabsBar({
	views,
	openViewIds,
	activeViewId,
	onViewSelect,
	onCloseTab,
	onCreateView,
	allTabLabel = "All",
	onAllTabClick,
	className,
}: ViewTabsBarProps) {
	const defaultView = views.find((v) => v.isDefault);
	const isAllActive = !activeViewId || activeViewId === defaultView?.id;

	const openViews = useMemo(() => {
		return openViewIds
			.map((id) => views.find((v) => v.id === id))
			.filter((v): v is SavedView => v !== undefined && !v.isDefault);
	}, [openViewIds, views]);

	return (
		<div
			className={cn(
				"flex items-center gap-1 border-b border-border/50 px-1",
				className,
			)}
		>
			<TabButton
				isActive={isAllActive}
				onClick={() => {
					if (defaultView) {
						onViewSelect(defaultView);
					} else {
						onAllTabClick?.();
					}
				}}
			>
				{allTabLabel}
			</TabButton>

			{openViews.map((view) => (
				<TabButton
					key={view.id}
					isActive={view.id === activeViewId}
					onClick={() => onViewSelect(view)}
					icon={view.icon}
					iconColor={view.color}
					onClose={() => onCloseTab(view.id)}
				>
					{view.name}
				</TabButton>
			))}

			<Button
				variant="ghost"
				size="sm"
				className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
				onClick={onCreateView}
			>
				<PlusIcon className="size-4" />
			</Button>
		</div>
	);
}

interface TabButtonProps {
	children: React.ReactNode;
	isActive: boolean;
	onClick: () => void;
	icon?: string | null;
	iconColor?: string | null;
	onClose?: () => void;
}

function TabButton({
	children,
	isActive,
	onClick,
	icon,
	iconColor,
	onClose,
}: TabButtonProps) {
	return (
		<div
			role="tab"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					onClick();
				}
			}}
			className={cn(
				"group relative flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
				"hover:text-foreground",
				isActive ? "text-foreground" : "text-muted-foreground",
			)}
		>
			{icon && (
				<DynamicIcon
					name={icon}
					className="size-4"
					style={iconColor ? { color: iconColor } : undefined}
				/>
			)}
			<span>{children}</span>
			{onClose && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
					className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted"
				>
					<XIcon className="size-3" />
				</button>
			)}
			{isActive && (
				<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
			)}
		</div>
	);
}
