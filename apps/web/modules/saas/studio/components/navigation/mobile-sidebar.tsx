"use client";

import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@repo/ui/components/drawer";
import { cn } from "@repo/ui/lib/utils";
import { ChevronLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import type {
	NavAreaConfig,
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../../lib/navigation/types";
import { CalendarWorkspaceSidebarContent } from "../calendar/calendar-sidebar-content";
import { IconByName } from "./icon-registry";

interface MobileSidebarProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	studioSlug: string;
	settingsEntryPath: string;
	railIcons: RailIconConfig[];
	activeModule: NavModuleConfig | null;
	activeRailItemId: string;
	utilities: NavItemConfig[];
	currentArea: string;
	areas: Record<string, NavAreaConfig>;
	pathname: string;
	onActiveRailItemPress?: () => void;
	onRailNavigationIntent?: (railItemId: string) => void;
}

function isItemActive(pathname: string, itemPath: string): boolean {
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function MobileSidebar({
	open,
	onOpenChange,
	studioSlug,
	settingsEntryPath,
	railIcons,
	activeModule,
	activeRailItemId,
	utilities,
	currentArea,
	areas,
	pathname,
	onActiveRailItemPress,
	onRailNavigationIntent,
}: MobileSidebarProps) {
	const isSettingsArea = currentArea === "studioSettings";
	const isCalendarArea = currentArea === "calendarWorkspace";
	const isMessagesArea = currentArea === "messagesWorkspace";
	const settingsArea = areas.studioSettings;
	const messagesArea = areas.messagesWorkspace;
	const mobileRailItems = [
		...railIcons,
		{
			id: "studioSettings",
			kind: "area" as const,
			icon: "Settings" as const,
			label: "Settings",
			href: settingsEntryPath,
		},
	];
	const activeTitle = isSettingsArea
		? (settingsArea?.title ?? "Settings")
		: isCalendarArea
			? (areas.calendarWorkspace?.title ?? "Calendar")
			: isMessagesArea
				? (messagesArea?.title ?? "Messages")
				: (activeModule?.label ?? "Navigation");

	return (
		<>
			<Drawer open={open} onOpenChange={onOpenChange}>
				<DrawerContent className="max-h-[78vh] border-neutral-200 bg-white md:hidden">
					<DrawerHeader className="pb-2 text-left">
						<DrawerTitle className="text-base font-semibold text-neutral-900">
							{activeTitle}
						</DrawerTitle>
					</DrawerHeader>

					<div className="scrollbar-hide overflow-y-auto px-4 pb-6">
						{isSettingsArea && settingsArea ? (
							<div className="flex flex-col gap-6">
								{settingsArea.backHref ? (
									<Link
										href={
											settingsArea.backHref ??
											`/app/${studioSlug}/home`
										}
										onClick={() => onOpenChange(false)}
										className="group -mt-1 flex items-center gap-3 px-1 py-1"
									>
										<div className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors group-hover:bg-neutral-200">
											<ChevronLeft
												className="size-3"
												strokeWidth={2.5}
											/>
										</div>
										<span className="text-sm font-medium text-neutral-700">
											Back to home
										</span>
									</Link>
								) : null}

								{settingsArea.sections.map((section) => (
									<div key={section.id}>
										{section.label ? (
											<div className="mb-2 pl-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
												{section.label}
											</div>
										) : null}
										<nav className="flex flex-col gap-0.5">
											{section.items.map((item) => (
												<MobileNavItem
													key={item.id}
													item={item}
													isActive={isItemActive(
														pathname,
														item.path,
													)}
													onSelect={() =>
														onOpenChange(false)
													}
												/>
											))}
										</nav>
									</div>
								))}

								{settingsArea.standaloneItems &&
								settingsArea.standaloneItems.length > 0 ? (
									<div className="border-t border-neutral-200 pt-3">
										<nav className="flex flex-col gap-0.5">
											{settingsArea.standaloneItems.map(
												(item) => (
													<MobileNavItem
														key={item.id}
														item={item}
														isActive={isItemActive(
															pathname,
															item.path,
														)}
														onSelect={() =>
															onOpenChange(false)
														}
													/>
												),
											)}
										</nav>
									</div>
								) : null}
							</div>
						) : isCalendarArea && areas.calendarWorkspace ? (
							<div className="-mx-4 -mb-6">
								<CalendarWorkspaceSidebarContent
									area={areas.calendarWorkspace}
								/>
							</div>
						) : isMessagesArea && messagesArea ? (
							<MobileAreaContent
								area={messagesArea}
								pathname={pathname}
								onSelect={() => onOpenChange(false)}
							/>
						) : activeModule ? (
							<div className="flex flex-col gap-6">
								{activeModule.sections.map((section) => (
									<div key={section.id}>
										{section.label ? (
											<div className="mb-2 pl-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
												{section.label}
											</div>
										) : null}
										<nav className="flex flex-col gap-0.5">
											{section.items.map((item) => (
												<MobileNavItem
													key={item.id}
													item={item}
													isActive={isItemActive(
														pathname,
														item.path,
													)}
													onSelect={() =>
														onOpenChange(false)
													}
												/>
											))}
										</nav>
									</div>
								))}

								{utilities.length > 0 ? (
									<div className="border-t border-neutral-200 pt-3">
										<nav className="flex flex-col gap-0.5">
											{utilities.map((item) => (
												<MobileNavItem
													key={item.id}
													item={item}
													isActive={isItemActive(
														pathname,
														item.path,
													)}
													onSelect={() =>
														onOpenChange(false)
													}
												/>
											))}
										</nav>
									</div>
								) : null}
							</div>
						) : null}
					</div>
				</DrawerContent>
			</Drawer>

			<nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
				<div
					className="grid px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2"
					style={{
						gridTemplateColumns: `repeat(${mobileRailItems.length}, minmax(0, 1fr))`,
					}}
				>
					{mobileRailItems.map((item) => {
						const isActive = item.id === activeRailItemId;
						return (
							<Link
								key={item.id}
								href={item.href}
								onClick={(event) => {
									if (isActive) {
										event.preventDefault();
										onActiveRailItemPress?.();
										return;
									}

									onRailNavigationIntent?.(item.id);
								}}
								className={cn(
									"flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
									isActive
										? "text-blue-600"
										: "text-neutral-500 hover:text-neutral-900",
								)}
							>
								<IconByName
									name={item.icon}
									className="size-5 shrink-0"
								/>
								<span className="truncate text-[11px] font-medium">
									{item.label}
								</span>
							</Link>
						);
					})}
				</div>
			</nav>
		</>
	);
}

function MobileNavItem({
	item,
	isActive,
	onSelect,
}: {
	item: NavItemConfig;
	isActive: boolean;
	onSelect?: () => void;
}) {
	const isExternal = item.path.startsWith("http");

	return (
		<Link
			href={item.path}
			target={isExternal ? "_blank" : undefined}
			rel={isExternal ? "noopener noreferrer" : undefined}
			onClick={onSelect}
			className={cn(
				"group flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-sm transition-[background-color,color,font-weight] duration-75",
				isActive
					? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
					: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
			)}
		>
			<span className="flex min-w-0 items-center gap-2.5">
				<IconByName
					name={item.icon}
					className={cn(
						"size-4 shrink-0",
						isActive ? "text-blue-600" : "text-neutral-600",
					)}
				/>
				<span className="truncate">{item.label}</span>
			</span>
			{isExternal ? (
				<ExternalLink className="size-3.5 text-neutral-500 transition-transform duration-75 group-hover:-translate-y-px group-hover:translate-x-px" />
			) : null}
		</Link>
	);
}

function MobileAreaContent({
	area,
	pathname,
	onSelect,
}: {
	area: NavAreaConfig;
	pathname: string;
	onSelect?: () => void;
}) {
	return (
		<div className="flex flex-col gap-6">
			{area.backHref ? (
				<Link
					href={area.backHref}
					onClick={onSelect}
					className="group -mt-1 flex items-center gap-3 px-1 py-1"
				>
					<div className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors group-hover:bg-neutral-200">
						<ChevronLeft className="size-3" strokeWidth={2.5} />
					</div>
					<span className="text-sm font-medium text-neutral-700">
						Back to home
					</span>
				</Link>
			) : null}

			{area.standaloneItems?.length ? (
				<nav className="flex flex-col gap-0.5">
					{area.standaloneItems.map((item) => (
						<MobileNavItem
							key={item.id}
							item={item}
							isActive={isItemActive(pathname, item.path)}
							onSelect={onSelect}
						/>
					))}
				</nav>
			) : null}

			{area.sections.map((section) => (
				<div key={section.id}>
					{section.label ? (
						<div className="mb-2 pl-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
							{section.label}
						</div>
					) : null}
					<nav className="flex flex-col gap-0.5">
						{section.items.map((item) => (
							<MobileNavItem
								key={item.id}
								item={item}
								isActive={isItemActive(pathname, item.path)}
								onSelect={onSelect}
							/>
						))}
					</nav>
				</div>
			))}
		</div>
	);
}
