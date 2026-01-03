"use client";

import { Button } from "@repo/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { forwardRef } from "react";
import { useSidebar } from "./sidebar-context";

interface SidebarTriggerProps
	extends React.ComponentPropsWithoutRef<typeof Button> {
	/** Show tooltip with keyboard shortcut hint */
	showTooltip?: boolean;
}

/**
 * Button to toggle the sidebar panel open/closed
 * Uses the SidebarContext to manage state
 */
export const SidebarTrigger = forwardRef<
	HTMLButtonElement,
	SidebarTriggerProps
>(({ className, onClick, showTooltip = true, ...props }, ref) => {
	const { isPanelOpen, togglePanel } = useSidebar();

	const button = (
		<Button
			ref={ref}
			variant="ghost"
			size="icon"
			className={cn("size-8", className)}
			onClick={(event) => {
				onClick?.(event);
				togglePanel();
			}}
			aria-label={isPanelOpen ? "Collapse sidebar" : "Expand sidebar"}
			aria-expanded={isPanelOpen}
			{...props}
		>
			{isPanelOpen ? (
				<PanelLeftClose className="size-4" />
			) : (
				<PanelLeft className="size-4" />
			)}
		</Button>
	);

	if (!showTooltip) {
		return button;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="right" sideOffset={8}>
				<span>{isPanelOpen ? "Collapse" : "Expand"}</span>
				<kbd className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
					⌘B
				</kbd>
			</TooltipContent>
		</Tooltip>
	);
});

SidebarTrigger.displayName = "SidebarTrigger";
