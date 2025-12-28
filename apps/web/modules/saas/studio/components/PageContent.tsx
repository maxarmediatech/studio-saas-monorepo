"use client";

import { cn } from "@repo/ui/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { PropsWithChildren, ReactNode } from "react";
import { PageWidthWrapper } from "./PageWidthWrapper";

interface PageContentProps {
	/** Page title */
	title?: ReactNode;
	/** Explicit back link URL. If not provided, no back button is shown. */
	backHref?: string;
	/** Right-side actions (buttons, etc.) */
	controls?: ReactNode;
	/** Content below the title row but inside the header (search, filters, etc.) */
	headerContent?: ReactNode;
	className?: string;
	/** Class for the content wrapper below the header */
	contentClassName?: string;
}

/**
 * Page content wrapper matching Dub's PageContent pattern.
 * Provides consistent page structure with header and content areas.
 *
 * - Header spans full width with border
 * - Content inside header uses PageWidthWrapper for consistent padding
 * - Children are wrapped in PageWidthWrapper by default
 */
export function PageContent({
	title,
	backHref,
	controls,
	headerContent,
	className,
	contentClassName,
	children,
}: PropsWithChildren<PageContentProps>) {
	const hasHeader = !!(title || controls || headerContent);

	return (
		<div className={cn("flex flex-1 flex-col", className)}>
			{/* Header - spans full width, content inside has padding */}
			{hasHeader && (
				<div className="border-b border-neutral-200">
					<PageWidthWrapper>
						<div className="flex h-12 items-center justify-between gap-4 sm:h-16">
							<div className="flex min-w-0 items-center gap-2">
								{backHref && (
									<Link
										href={backHref}
										className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
									>
										<ChevronLeft className="size-5" />
									</Link>
								)}
								{title && (
									<h1 className="truncate text-lg font-semibold text-neutral-900">
										{title}
									</h1>
								)}
							</div>
							{controls && (
								<div className="flex items-center gap-2">{controls}</div>
							)}
						</div>
						{headerContent && <div className="pb-3">{headerContent}</div>}
					</PageWidthWrapper>
				</div>
			)}

			{/* Content area with padding */}
			<div className={cn("flex-1 pt-4 lg:pt-6", contentClassName)}>
				<PageWidthWrapper>{children}</PageWidthWrapper>
			</div>
		</div>
	);
}
