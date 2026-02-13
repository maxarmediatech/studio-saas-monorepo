import { cn } from "@repo/ui/lib/utils";
import type { PropsWithChildren, ReactNode } from "react";

export function SettingsItem({
	children,
	title,
	description,
	danger,
}: PropsWithChildren<{
	title: string | ReactNode;
	description?: string | ReactNode;
	danger?: boolean;
}>) {
	return (
		<div className="grid grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 md:grid-cols-3 lg:px-6">
			<div className="flex shrink-0 flex-col gap-1.5">
				<h2
					className={cn(
						"m-0 text-base/7 font-semibold",
						danger && "text-destructive",
					)}
				>
					{title}
				</h2>
				{description && (
					<p className="m-0 text-sm/6 text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			<div className="md:col-span-2">{children}</div>
		</div>
	);
}
