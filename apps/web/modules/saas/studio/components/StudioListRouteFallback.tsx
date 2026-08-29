import { Skeleton } from "@repo/ui/components/skeleton";
import type { ReactNode } from "react";

type Props = {
	label: string;
	children: ReactNode;
};

export function StudioListRouteFallback({ label, children }: Props) {
	return (
		<div className="space-y-4">
			<output className="sr-only" aria-label={`Loading ${label}`}>
				Loading {label}
			</output>
			<div className="flex h-9 items-center gap-2" aria-hidden="true">
				<Skeleton className="h-9 min-w-0 flex-1 sm:max-w-80" />
				<Skeleton className="h-9 w-20" />
				<Skeleton className="h-9 w-9" />
			</div>
			<div aria-hidden="true">{children}</div>
		</div>
	);
}
