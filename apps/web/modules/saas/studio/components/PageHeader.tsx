"use client";

import { Separator } from "@repo/ui/components/separator";
import { SidebarTrigger } from "@repo/ui/components/sidebar";
import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
	backButton?: ReactNode;
}

export function PageHeader({
	title,
	description,
	actions,
	backButton,
}: PageHeaderProps) {
	return (
		<header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-4 mb-6">
			<div className="flex flex-1 items-center justify-between gap-2">
				{/* Left side */}
				<div className="flex items-center gap-2">
					{/* Mobile sidebar trigger */}
					<div className="flex items-center md:hidden">
						<SidebarTrigger />
						<Separator
							orientation="vertical"
							className="ml-2 mr-2 data-[orientation=vertical]:h-4"
						/>
					</div>

					{/* Back button (optional) */}
					{backButton}

					{/* Title */}
					<div>
						<h1 className="font-semibold text-base text-foreground">
							{title}
						</h1>
						{description && (
							<p className="text-sm text-muted-foreground hidden sm:block">
								{description}
							</p>
						)}
					</div>
				</div>

				{/* Right side - actions */}
				{actions && (
					<div className="flex items-center gap-2">{actions}</div>
				)}
			</div>
		</header>
	);
}
