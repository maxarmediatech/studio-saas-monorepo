import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

interface PageWidthWrapperProps {
	className?: string;
	children: ReactNode;
}

/**
 * Wrapper that provides consistent horizontal padding and max-width.
 * Use this inside PageContent to wrap content that needs standard margins.
 */
export function PageWidthWrapper({
	className,
	children,
}: PageWidthWrapperProps) {
	return (
		<div
			className={cn(
				"mx-auto w-full max-w-screen-xl px-4 lg:px-6",
				className,
			)}
		>
			{children}
		</div>
	);
}
