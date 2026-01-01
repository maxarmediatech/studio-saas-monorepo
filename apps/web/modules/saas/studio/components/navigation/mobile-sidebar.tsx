"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { ChevronLeft, ExternalLink, Settings } from "lucide-react";
import { Logo } from "@shared/components/Logo";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import type {
	NavAreaConfig,
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

interface MobileSidebarProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	railIcons: RailIconConfig[];
	activeModule: NavModuleConfig | null;
	activeModuleId: string;
	utilities: NavItemConfig[];
	currentArea: string;
	areas: Record<string, NavAreaConfig>;
	pathname: string;
}

const isSettingsPath = (pathname: string, studioSlug: string) =>
	pathname.startsWith(`/app/${studioSlug}/settings`);

function isItemActive(pathname: string, itemPath: string): boolean {
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function MobileSidebar({
	open,
	onOpenChange,
	studioSlug,
	studioName,
	studioLogo,
	railIcons,
	activeModule,
	activeModuleId,
	utilities,
	currentArea,
	areas,
	pathname,
}: MobileSidebarProps) {
	const isSettingsArea = currentArea === "studioSettings";
	const settingsArea = areas.studioSettings;
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="left" className="flex w-80 flex-col bg-neutral-200 p-0">
				{/* Header with App Logo + Org */}
				<SheetHeader className="border-b border-neutral-300 bg-neutral-200 px-4 py-3">
					<SheetTitle className="flex items-center gap-3">
						<Logo withLabel={false} className="h-5" />
						<div className="flex items-center gap-2">
							<OrganizationLogo
								name={studioName}
								logoUrl={studioLogo}
								className="size-6 rounded-full"
							/>
							<span className="text-sm font-medium text-neutral-700">{studioName}</span>
						</div>
					</SheetTitle>
				</SheetHeader>

				{/* Module Tabs */}
				<div className="flex gap-1 overflow-x-auto bg-neutral-200 px-3 py-2">
					{railIcons.map((item) => {
						const isActive = item.moduleId === activeModuleId && !isSettingsArea;
						return (
							<Link
								key={item.moduleId}
								href={item.defaultPath}
								className={cn(
									"flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
									isActive
										? "bg-white font-medium text-neutral-900"
										: "text-neutral-600 hover:bg-black/5 active:bg-black/10"
								)}
							>
								<IconByName name={item.icon} className="size-4" />
								<span>{item.label}</span>
							</Link>
						);
					})}
					{/* Settings Tab */}
					<Link
						href={`/app/${studioSlug}/settings`}
						className={cn(
							"flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
							isSettingsArea
								? "bg-white font-medium text-neutral-900"
								: "text-neutral-600 hover:bg-black/5 active:bg-black/10"
						)}
					>
						<Settings className="size-4" />
						<span>Settings</span>
					</Link>
				</div>

				{/* Content Panel - Dub style */}
				<div className="flex-1 overflow-hidden p-2 pt-0">
					<div className="scrollbar-hide h-full overflow-y-auto rounded-xl bg-neutral-100 p-3">
						{isSettingsArea && settingsArea ? (
							<>
								{/* Settings Header with back button */}
								<Link
									href={settingsArea.backHref ?? `/app/${studioSlug}/home`}
									className="group mb-2 flex items-center gap-3 px-2 py-2"
								>
									<div className="flex size-6 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600 transition-[transform,background-color] duration-150 group-hover:-translate-x-0.5 group-hover:bg-neutral-300">
										<ChevronLeft className="size-3" strokeWidth={2.5} />
									</div>
									<span className="text-lg font-semibold text-neutral-900">
										{settingsArea.title}
									</span>
								</Link>

								{/* Settings Sections */}
								<div className="flex flex-col gap-6">
									{settingsArea.sections.map((section) => (
										<div key={section.id}>
											{section.label && (
												<div className="mb-2 pl-2 text-sm text-neutral-500">
													{section.label}
												</div>
											)}
											<nav className="flex flex-col gap-0.5">
												{section.items.map((item) => (
													<MobileNavItem
														key={item.id}
														item={item}
														isActive={isItemActive(pathname, item.path)}
													/>
												))}
											</nav>
										</div>
									))}
								</div>
							</>
						) : activeModule ? (
							<>
								{/* Module Title */}
								<div className="mb-2 px-2 py-2">
									<h2 className="text-lg font-semibold text-neutral-900">
										{activeModule.label}
									</h2>
								</div>

								{/* Sections */}
								<div className="flex flex-col gap-6">
									{activeModule.sections.map((section) => (
										<div key={section.id}>
											{section.label && (
												<div className="mb-2 pl-2 text-sm text-neutral-500">
													{section.label}
												</div>
											)}
											<nav className="flex flex-col gap-0.5">
												{section.items.map((item) => (
													<MobileNavItem
														key={item.id}
														item={item}
														isActive={isItemActive(pathname, item.path)}
													/>
												))}
											</nav>
										</div>
									))}
								</div>

								{/* Footer: Utilities */}
								{utilities.length > 0 && (
									<div className="mt-6 border-t border-neutral-200 pt-3">
										<nav className="flex flex-col gap-0.5">
											{utilities.map((item) => (
												<MobileNavItem
													key={item.id}
													item={item}
													isActive={isItemActive(pathname, item.path)}
												/>
											))}
										</nav>
									</div>
								)}
							</>
						) : null}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}

function MobileNavItem({
	item,
	isActive,
}: {
	item: NavItemConfig;
	isActive: boolean;
}) {
	const isExternal = item.path.startsWith("http");

	return (
		<Link
			href={item.path}
			target={isExternal ? "_blank" : undefined}
			rel={isExternal ? "noopener noreferrer" : undefined}
			className={cn(
				"group flex h-8 items-center justify-between rounded-lg p-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
				isActive
					? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
					: "text-neutral-700 hover:bg-black/5 active:bg-black/10"
			)}
		>
			<span className="flex items-center gap-2.5">
				<IconByName
					name={item.icon}
					className={cn(
						"size-4 shrink-0",
						isActive ? "text-blue-600" : "text-neutral-600"
					)}
				/>
				<span className="truncate">{item.label}</span>
			</span>
			{isExternal && (
				<ExternalLink className="size-3.5 text-neutral-500 transition-transform duration-75 group-hover:-translate-y-px group-hover:translate-x-px" />
			)}
		</Link>
	);
}
