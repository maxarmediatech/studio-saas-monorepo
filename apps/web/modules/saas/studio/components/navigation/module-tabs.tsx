"use client";

import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import type { NavModuleConfig } from "../../lib/navigation/types";

interface ModuleTabsProps {
	modules: NavModuleConfig[];
	activeModuleId: string;
}

export function ModuleTabs({ modules, activeModuleId }: ModuleTabsProps) {
	return (
		<nav
			aria-label="Primary modules"
			className="hidden items-center gap-1 overflow-x-auto whitespace-nowrap px-2 md:flex"
		>
			{modules.map((module) => {
				const isActive = module.id === activeModuleId;

				return (
					<Link
						key={module.id}
						href={module.defaultPath}
						className={cn(
							"flex items-center rounded-sm px-4 py-2 text-sm font-medium",
							isActive
								? "bg-primary/5 text-primary"
								: "text-muted-foreground hover:bg-primary/5 hover:text-primary",
						)}
					>
						<span>{module.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
