"use client";

import { cn } from "@repo/ui/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	description?: string;
	/** Explicit back link URL. If not provided, no back button is shown. */
	backHref?: string;
	/** Right-side actions (buttons, etc.) */
	actions?: ReactNode;
	/** Content below the title row (search, filters, etc.) */
	headerContent?: ReactNode;
	className?: string;
}

/**
 * Page header component matching Dub's PageContentHeader pattern.
 * Sits at the top of page content with title, optional back link, and actions.
 */
export function PageHeader({
	title,
	description,
	backHref,
	actions,
	headerContent,
	className,
}: PageHeaderProps) {
	return (
		<div className={cn("border-b border-neutral-200", className)}>
			<div className="flex h-12 items-center justify-between gap-4 sm:h-14">
				<div className="flex min-w-0 items-center gap-2">
					{backHref && (
						<Link
							href={backHref}
							className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
						>
							<ChevronLeft className="size-5" />
						</Link>
					)}
					<div className="min-w-0">
						<h1 className="truncate text-lg font-semibold text-neutral-900">
							{title}
						</h1>
						{description && (
							<p className="truncate text-sm text-neutral-500 hidden sm:block">
								{description}
							</p>
						)}
					</div>
				</div>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
			{headerContent && <div className="pb-3 pt-1">{headerContent}</div>}
		</div>
	);
}
