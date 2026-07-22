import { cn } from "@repo/ui/lib/utils";
import * as React from "react";

function Textarea({
	className,
	size = "default",
	...props
}: React.ComponentProps<"textarea"> & {
	size?: "default" | "sm";
}) {
	return (
		<textarea
			data-slot="textarea"
			data-size={size}
			className={cn(
				"border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				size === "sm" && "px-2.5 text-13 md:text-13",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
