"use client";

import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@repo/ui/components/drawer";
import { getIcon } from "../lib/icons";
import type { ModuleId, NavItem, NavModule } from "../lib/types";
import { ModulePanel } from "./ModulePanel";

interface MobileNavProps {
	modules: NavModule[];
	utilities: NavItem[];
	activeModuleId: ModuleId;
	onModuleChange: (moduleId: ModuleId) => void;
	isDrawerOpen: boolean;
	onDrawerOpenChange: (open: boolean) => void;
}

export function MobileNav({
	modules,
	utilities,
	activeModuleId,
	onModuleChange,
	isDrawerOpen,
	onDrawerOpenChange,
}: MobileNavProps) {
	const activeModule =
		modules.find((module) => module.id === activeModuleId) ?? modules[0];

	return (
		<>
			{/* Mobile drawer showing panel content */}
			<Drawer open={isDrawerOpen} onOpenChange={onDrawerOpenChange} dismissible>
				<DrawerContent className="md:hidden">
					<DrawerHeader>
						<DrawerTitle>{activeModule.label}</DrawerTitle>
					</DrawerHeader>
					<div className="pb-6">
						<ModulePanel module={activeModule} utilities={utilities} />
					</div>
				</DrawerContent>
			</Drawer>

			{/* Mobile bottom nav */}
			<nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
				<div className="grid grid-cols-5">
					{modules.map((module) => {
						const Icon = getIcon(module.icon);
						const isActive = module.id === activeModuleId;
						return (
							<button
								key={module.id}
								type="button"
								onClick={() => {
									onModuleChange(module.id);
									onDrawerOpenChange(true);
								}}
								className={`flex flex-col items-center gap-1 py-2 text-xs ${
									isActive
										? "text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
								aria-label={module.label}
							>
								<Icon className="h-5 w-5" />
								<span className="truncate text-[10px]">{module.label}</span>
							</button>
						);
					})}
				</div>
			</nav>
		</>
	);
}
