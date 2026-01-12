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
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	LayersIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	StarIcon,
	Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DynamicIcon } from "./DynamicIcon";
import type { SavedView } from "./types";

interface ViewBreadcrumbProps {
	views: SavedView[];
	activeViewId: string | null;
	onViewSelect: (view: SavedView) => void;
	onCreateView: () => void;
	onToggleFavorite: (viewId: string) => void;
	onEditView?: (view: SavedView) => void;
	onDeleteView?: (viewId: string) => void;
	isLoading?: boolean;
	disabled?: boolean;
}

export function ViewBreadcrumb({
	views,
	activeViewId,
	onViewSelect,
	onCreateView,
	onToggleFavorite,
	onEditView,
	onDeleteView,
	isLoading,
	disabled,
}: ViewBreadcrumbProps) {
	const [open, setOpen] = useState(false);

	const defaultView = useMemo(() => views.find((v) => v.isDefault), [views]);

	const displayedView = useMemo(() => {
		if (activeViewId) {
			return views.find((v) => v.id === activeViewId);
		}
		return defaultView;
	}, [views, activeViewId, defaultView]);

	const effectiveViewId = activeViewId ?? defaultView?.id ?? null;

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
		<div className="flex items-center gap-1 text-sm">
			<span className="flex items-center gap-1.5 text-muted-foreground">
				<LayersIcon className="size-4" />
				<span>Views</span>
			</span>

			<ChevronRightIcon className="size-4 text-muted-foreground/50" />

			<DropdownMenu open={open} onOpenChange={setOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={cn(
							"h-7 gap-1.5 px-2",
							"hover:bg-muted/50",
							"font-medium",
						)}
						disabled={isLoading || disabled}
					>
						{displayedView?.icon && (
							<DynamicIcon
								name={displayedView.icon}
								className="size-4"
								style={
									displayedView.color
										? { color: displayedView.color }
										: undefined
								}
							/>
						)}
						<span>{displayedView?.name ?? "All"}</span>
						<ChevronDownIcon className="size-3.5 text-muted-foreground" />
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
										isActive={view.id === effectiveViewId}
										onSelect={() => {
											onViewSelect(view);
											setOpen(false);
										}}
										onToggleFavorite={() =>
											onToggleFavorite(view.id)
										}
										onEdit={
											onEditView
												? () => {
														onEditView(view);
														setOpen(false);
													}
												: undefined
										}
										onDelete={
											onDeleteView
												? () => {
														onDeleteView(view.id);
														setOpen(false);
													}
												: undefined
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
								isActive={view.id === effectiveViewId}
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
										isActive={view.id === effectiveViewId}
										onSelect={() => {
											onViewSelect(view);
											setOpen(false);
										}}
										onToggleFavorite={() =>
											onToggleFavorite(view.id)
										}
										onEdit={
											onEditView
												? () => {
														onEditView(view);
														setOpen(false);
													}
												: undefined
										}
										onDelete={
											onDeleteView
												? () => {
														onDeleteView(view.id);
														setOpen(false);
													}
												: undefined
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
		</div>
	);
}

interface ViewMenuItemProps {
	view: SavedView;
	isActive: boolean;
	onSelect: () => void;
	onToggleFavorite: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}

function ViewMenuItem({
	view,
	isActive,
	onSelect,
	onToggleFavorite,
	onEdit,
	onDelete,
}: ViewMenuItemProps) {
	const [contextMenuOpen, setContextMenuOpen] = useState(false);

	const showContextMenu = !view.isSystem && (onEdit || onDelete);

	return (
		<DropdownMenuItem
			onSelect={(e) => {
				if (contextMenuOpen) {
					e.preventDefault();
					return;
				}
				onSelect();
			}}
			className="group flex items-center justify-between gap-2"
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
				{showContextMenu && (
					<DropdownMenu
						open={contextMenuOpen}
						onOpenChange={setContextMenuOpen}
					>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
								}}
								className={cn(
									"rounded p-0.5 hover:bg-muted text-muted-foreground",
									"opacity-0 group-hover:opacity-100",
									contextMenuOpen && "opacity-100",
								)}
							>
								<MoreHorizontalIcon className="size-4" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							side="right"
							className="w-40"
							onClick={(e) => e.stopPropagation()}
						>
							<DropdownMenuItem
								onSelect={(e) => {
									e.stopPropagation();
									onToggleFavorite();
									setContextMenuOpen(false);
								}}
								className="gap-2"
							>
								<StarIcon
									className={cn(
										"size-4",
										view.isFavorite &&
											"fill-yellow-500 text-yellow-500",
									)}
								/>
								<span>
									{view.isFavorite
										? "Remove from favorites"
										: "Add to favorites"}
								</span>
							</DropdownMenuItem>
							{onEdit && (
								<DropdownMenuItem
									onSelect={(e) => {
										e.stopPropagation();
										onEdit();
										setContextMenuOpen(false);
									}}
									className="gap-2"
								>
									<PencilIcon className="size-4" />
									<span>Edit</span>
								</DropdownMenuItem>
							)}
							{onDelete && (
								<DropdownMenuItem
									onSelect={(e) => {
										e.stopPropagation();
										onDelete();
										setContextMenuOpen(false);
									}}
									className="gap-2 text-destructive focus:text-destructive"
								>
									<Trash2Icon className="size-4" />
									<span>Delete</span>
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</DropdownMenuItem>
	);
}
