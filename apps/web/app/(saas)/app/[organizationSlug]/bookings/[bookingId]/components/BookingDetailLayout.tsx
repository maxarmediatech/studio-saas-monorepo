"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

interface BookingDetailLayoutProps {
	header: ReactNode;
	children: ReactNode;
	className?: string;
}

export function BookingDetailLayout({
	header,
	children,
	className,
}: BookingDetailLayoutProps) {
	return (
		<div className={cn("flex h-full min-h-0 flex-1 flex-col", className)}>
			<header className="shrink-0 border-b bg-background">
				<div className="px-4 py-3 sm:px-6 lg:px-8">{header}</div>
			</header>

			<main className="flex min-h-0 flex-1 flex-col">
				<div className="flex-1 overflow-y-auto">
					<div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
						<div className="space-y-6">{children}</div>
					</div>
				</div>
			</main>
		</div>
	);
}
