"use client";

import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@repo/ui/components/drawer";
import { cn } from "@repo/ui/lib/utils";
import { getIcon } from "../lib/icons";
import type { ModuleId, NavItem, NavModule } from "../lib/types";
import { ModulePanel } from "./ModulePanel";

interface MobileNavProps {
	studioSlug: string;
	modules: NavModule[];
	utilities: NavItem[];
	/** The module that owns the current URL */
	urlModuleId: ModuleId;
	/** The module currently displayed in the panel (can differ when browsing) */
	displayedModuleId: ModuleId;
	onModuleChange: (moduleId: ModuleId) => void;
	isDrawerOpen: boolean;
	onDrawerOpenChange: (open: boolean) => void;
}

/**
 * Get the appropriate grid class based on module count
 */
function getGridClass(moduleCount: number): string {
	switch (moduleCount) {
		case 1:
			return "grid-cols-1";
		case 2:
			return "grid-cols-2";
		case 3:
			return "grid-cols-3";
		case 4:
			return "grid-cols-4";
		case 5:
			return "grid-cols-5";
		default:
			// For 6+ modules, use auto-fit with minimum width
			return "grid-cols-[repeat(auto-fit,minmax(60px,1fr))]";
	}
}

export function MobileNav({
	studioSlug,
	modules,
	utilities,
	urlModuleId,
	displayedModuleId,
	onModuleChange,
	isDrawerOpen,
	onDrawerOpenChange,
}: MobileNavProps) {
	// Get the module to display in the drawer
	const displayedModule =
		modules.find((m) => m.id === displayedModuleId) ?? modules[0];

	// Safety check
	if (!displayedModule) {
		return null;
	}

	return (
		<>
			{/* Mobile drawer showing panel content */}
			<Drawer
				open={isDrawerOpen}
				onOpenChange={onDrawerOpenChange}
				dismissible
			>
				<DrawerContent className="md:hidden">
					<DrawerHeader>
						<DrawerTitle>{displayedModule.label}</DrawerTitle>
					</DrawerHeader>
					<div className="pb-6">
						<ModulePanel
							studioSlug={studioSlug}
							module={displayedModule}
							utilities={utilities}
						/>
					</div>
				</DrawerContent>
			</Drawer>

			{/* Mobile bottom nav */}
			<nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
				<div className={cn("grid", getGridClass(modules.length))}>
					{modules.map((module) => {
						const Icon = getIcon(module.icon);
						// Show as active if this is the URL's module OR the currently displayed module
						const isActive =
							urlModuleId === module.id ||
							displayedModuleId === module.id;

						return (
							<button
								key={module.id}
								type="button"
								onClick={() => {
									onModuleChange(module.id);
									onDrawerOpenChange(true);
								}}
								className={cn(
									"flex flex-col items-center gap-1 py-2 text-xs",
									isActive
										? "text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
								aria-label={module.label}
								aria-current={
									urlModuleId === module.id
										? "true"
										: undefined
								}
							>
								<Icon className="size-5" />
								<span className="truncate text-[10px]">
									{module.label}
								</span>
							</button>
						);
					})}
				</div>
			</nav>
		</>
	);
}
