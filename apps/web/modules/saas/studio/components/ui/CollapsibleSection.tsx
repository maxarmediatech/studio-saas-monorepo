"use client";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface CollapsibleSectionProps {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
	className?: string;
}

export function CollapsibleSection({
	title,
	children,
	defaultOpen = false,
	className,
}: CollapsibleSectionProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className={className}
		>
			<CollapsibleTrigger
				type="button"
				className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
			>
				{title}
				<ChevronDown
					className={cn(
						"h-4 w-4 transition-transform duration-200",
						isOpen && "rotate-180",
					)}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="pt-2 space-y-4">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}
