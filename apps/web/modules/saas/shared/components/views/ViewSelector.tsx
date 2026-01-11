"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, PlusIcon, StarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { SavedView } from "./types";
import { DynamicIcon } from "./DynamicIcon";

interface ViewSelectorProps {
	views: SavedView[];
	activeViewId: string | null;
	onViewSelect: (view: SavedView) => void;
	onCreateView: () => void;
	onToggleFavorite: (viewId: string) => void;
	isLoading?: boolean;
	disabled?: boolean;
}

export function ViewSelector({
	views,
	activeViewId,
	onViewSelect,
	onCreateView,
	onToggleFavorite,
	isLoading,
	disabled,
}: ViewSelectorProps) {
	const [open, setOpen] = useState(false);

	const activeView = useMemo(
		() => views.find((v) => v.id === activeViewId),
		[views, activeViewId],
	);

	const { systemViews, userViews, favoriteViews } = useMemo(() => {
		const system = views.filter((v) => v.isSystem);
		const user = views.filter((v) => !v.isSystem);
		const favorites = views.filter((v) => v.isFavorite);
		return {
			systemViews: system,
			userViews: user,
			favoriteViews: favorites,
		};
	}, [views]);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"h-8 gap-2 px-3",
						"border-border bg-background",
						"hover:bg-muted/50",
					)}
					disabled={isLoading || disabled}
				>
					{activeView?.icon && (
						<DynamicIcon
							name={activeView.icon}
							className="size-4"
							style={
								activeView.color
									? { color: activeView.color }
									: undefined
							}
						/>
					)}
					<span className="font-medium">
						{activeView?.name ?? "Select View"}
					</span>
					<ChevronDownIcon className="size-4 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align="start"
				className="w-64"
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				{favoriteViews.length > 0 && (
					<>
						<DropdownMenuLabel className="text-xs text-muted-foreground">
							Favorites
						</DropdownMenuLabel>
						<DropdownMenuGroup>
							{favoriteViews.map((view) => (
								<ViewMenuItem
									key={view.id}
									view={view}
									isActive={view.id === activeViewId}
									onSelect={() => {
										onViewSelect(view);
										setOpen(false);
									}}
									onToggleFavorite={() =>
										onToggleFavorite(view.id)
									}
								/>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
					</>
				)}

				<DropdownMenuLabel className="text-xs text-muted-foreground">
					Views
				</DropdownMenuLabel>
				<DropdownMenuGroup>
					{systemViews.map((view) => (
						<ViewMenuItem
							key={view.id}
							view={view}
							isActive={view.id === activeViewId}
							onSelect={() => {
								onViewSelect(view);
								setOpen(false);
							}}
							onToggleFavorite={() => onToggleFavorite(view.id)}
						/>
					))}
				</DropdownMenuGroup>

				{userViews.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-xs text-muted-foreground">
							My Views
						</DropdownMenuLabel>
						<DropdownMenuGroup>
							{userViews.map((view) => (
								<ViewMenuItem
									key={view.id}
									view={view}
									isActive={view.id === activeViewId}
									onSelect={() => {
										onViewSelect(view);
										setOpen(false);
									}}
									onToggleFavorite={() =>
										onToggleFavorite(view.id)
									}
								/>
							))}
						</DropdownMenuGroup>
					</>
				)}

				<DropdownMenuSeparator />
				<DropdownMenuItem
					onSelect={() => {
						onCreateView();
						setOpen(false);
					}}
					className="gap-2"
				>
					<PlusIcon className="size-4" />
					<span>Create new view</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface ViewMenuItemProps {
	view: SavedView;
	isActive: boolean;
	onSelect: () => void;
	onToggleFavorite: () => void;
}

function ViewMenuItem({
	view,
	isActive,
	onSelect,
	onToggleFavorite,
}: ViewMenuItemProps) {
	return (
		<DropdownMenuItem
			onSelect={onSelect}
			className="flex items-center justify-between gap-2"
		>
			<div className="flex items-center gap-2">
				{view.icon && (
					<DynamicIcon
						name={view.icon}
						className="size-4"
						style={view.color ? { color: view.color } : undefined}
					/>
				)}
				<span className={cn(isActive && "font-medium")}>
					{view.name}
				</span>
			</div>
			<div className="flex items-center gap-1">
				{isActive && <CheckIcon className="size-4 text-primary" />}
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onToggleFavorite();
					}}
					className={cn(
						"p-0.5 rounded hover:bg-muted",
						view.isFavorite
							? "text-yellow-500"
							: "text-muted-foreground opacity-0 group-hover:opacity-100",
					)}
				>
					<StarIcon
						className="size-3.5"
						fill={view.isFavorite ? "currentColor" : "none"}
					/>
				</button>
			</div>
		</DropdownMenuItem>
	);
}
