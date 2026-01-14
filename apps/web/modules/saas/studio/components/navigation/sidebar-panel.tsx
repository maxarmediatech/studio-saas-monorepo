"use client";

import {
	Collapsible,
	CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
	ChevronDown,
	ChevronRight,
	ExternalLink,
	SearchIcon,
	Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { HeaderCapabilities } from "../../lib/capability.server";
import type {
	NavItemConfig,
	NavModuleConfig,
} from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";
import { NewActionSwitcher } from "./new-action-switcher";
import { OrganizationSwitcher } from "./organization-switcher";

interface SidebarPanelProps {
	module: NavModuleConfig;
	utilities: NavItemConfig[];
	onSearchOpen?: () => void;
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	caps: HeaderCapabilities;
}

function isItemActive(pathname: string, itemPath: string): boolean {
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function SidebarPanel({
	module,
	utilities,
	onSearchOpen,
	studioSlug,
	studioName,
	studioLogo,
	caps,
}: SidebarPanelProps) {
	const pathname = usePathname();
	const [setupOpen, setSetupOpen] = useState(false);

	// Split sections: primary nav vs setup/configuration
	const primarySections = module.sections.filter(
		(s) => s.id !== "studio-setup",
	);
	const setupSection = module.sections.find((s) => s.id === "studio-setup");

	// Check if any setup item is currently active
	const isSetupActive =
		setupSection?.items.some((item) => isItemActive(pathname, item.path)) ??
		false;

	// Auto-expand configuration section when a setup item is active
	useEffect(() => {
		if (isSetupActive) {
			setSetupOpen(true);
		}
	}, [isSetupActive]);

	return (
		<div className="relative flex h-screen w-[var(--sidebar-panel-width)] flex-col overflow-hidden rounded-l-xl bg-neutral-100">
			{/* Navigation Content - animate on module switch */}
			<div
				key={module.id}
				className="relative flex min-h-0 flex-1 animate-in fade-in slide-in-from-right-2 flex-col text-neutral-500 duration-200"
			>
				{/* Header */}
				<div className="shrink-0 p-3">
					<div className="mb-2 flex items-center gap-2">
						<OrganizationSwitcher
							studioName={studioName}
							studioLogo={studioLogo}
							variant="panel"
						/>
						<div className="ml-auto flex items-center">
							<button
								type="button"
								onClick={onSearchOpen}
								className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-700 active:bg-black/10"
								aria-label="Search"
								title="Search (⌘K)"
							>
								<SearchIcon className="size-4" />
							</button>
						</div>
					</div>

					<div>
						<NewActionSwitcher
							studioSlug={studioSlug}
							caps={caps}
							variant="sidebar"
						/>
					</div>
				</div>

				{/* Primary Sections */}
				<div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3">
					{primarySections.map((section) => (
						<div key={section.id}>
							{section.label && (
								<div className="mb-2 pl-3 text-sm text-neutral-500">
									{section.label}
								</div>
							)}
							<nav className="flex flex-col gap-0.5">
								{section.items.map((item) => (
									<NavItem
										key={item.id}
										item={item}
										isActive={isItemActive(
											pathname,
											item.path,
										)}
									/>
								))}
							</nav>
						</div>
					))}
				</div>

				{/* Setup + Utilities pinned to bottom */}
				{(setupSection && setupSection.items.length > 0) ||
				utilities.length > 0 ? (
					<div className="shrink-0 px-3 pb-3 pt-1">
						{setupSection && setupSection.items.length > 0 && (
							<Collapsible
								open={setupOpen}
								onOpenChange={setSetupOpen}
								className="group/setup"
							>
								<div
									className={cn(
										"rounded-lg p-2",
										setupOpen && "bg-neutral-200/50",
									)}
								>
									{/* Collapsed trigger - shows "Configuration" label with active state */}
									<CollapsibleTrigger
										className={cn(
											"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
											setupOpen && "hidden",
											isSetupActive
												? "bg-blue-100/50 font-medium text-blue-600"
												: "text-neutral-600 hover:bg-neutral-200/50",
										)}
									>
										<Settings
											className={cn(
												"size-4",
												isSetupActive
													? "text-blue-600"
													: "text-neutral-500",
											)}
										/>
										<span className="font-medium">
											Configuration
										</span>
										<ChevronRight
											className={cn(
												"ml-auto size-4",
												isSetupActive
													? "text-blue-400"
													: "text-neutral-400",
											)}
										/>
									</CollapsibleTrigger>

									{/* Content - nav items with framer-motion */}
									<AnimatePresence initial={false}>
										{setupOpen && (
											<motion.nav
												initial={{
													height: 0,
													opacity: 0,
												}}
												animate={{
													height: "auto",
													opacity: 1,
													transition: {
														height: {
															type: "spring",
															stiffness: 500,
															damping: 40,
															mass: 1,
														},
														opacity: {
															duration: 0.2,
														},
													},
												}}
												exit={{
													height: 0,
													opacity: 0,
													transition: {
														height: {
															type: "spring",
															stiffness: 500,
															damping: 40,
															mass: 1,
														},
														opacity: { duration: 0.15 },
													},
												}}
												className="scrollbar-hide relative flex max-h-[40vh] flex-col gap-0.5 overflow-y-auto pr-6"
											>
												{/* Minimal corner chevron to collapse */}
												<CollapsibleTrigger className="absolute right-0 top-0 p-1 text-neutral-400 transition-colors hover:text-neutral-600">
													<ChevronDown className="size-4" />
												</CollapsibleTrigger>
												{setupSection.items.map(
													(item, i) => (
														<motion.div
															key={item.id}
															initial={{
																opacity: 0,
																x: -8,
															}}
															animate={{
																opacity: 1,
																x: 0,
																transition: {
																	delay:
																		i * 0.03,
																	duration:
																		0.2,
																	ease: [
																		0.25,
																		0.1,
																		0.25,
																		1,
																	],
																},
															}}
															exit={{
																opacity: 0,
																transition: {
																	duration: 0.1,
																},
															}}
														>
															<NavItem
																item={item}
																isActive={isItemActive(
																	pathname,
																	item.path,
																)}
															/>
														</motion.div>
													),
												)}
											</motion.nav>
										)}
									</AnimatePresence>
								</div>
							</Collapsible>
						)}

						{/* Footer: Utilities */}
						{utilities.length > 0 && (
							<div className="mt-3 border-t border-neutral-200 pt-3">
								<nav className="flex flex-col gap-0.5">
									{utilities.map((item) => (
										<NavItem
											key={item.id}
											item={item}
											isActive={isItemActive(
												pathname,
												item.path,
											)}
										/>
									))}
								</nav>
							</div>
						)}
					</div>
				) : null}
			</div>
		</div>
	);
}

function NavItem({
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
					: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
			)}
		>
			<span className="flex items-center gap-2.5">
				<IconByName
					name={item.icon}
					className={cn(
						"size-4 shrink-0",
						isActive ? "text-blue-600" : "text-neutral-600",
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
