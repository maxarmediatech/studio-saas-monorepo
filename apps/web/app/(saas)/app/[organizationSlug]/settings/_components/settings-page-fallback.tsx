import { Skeleton } from "@repo/ui/components/skeleton";

export function SettingsPageFallback() {
	return (
		<div className="space-y-8 px-4 py-6 lg:px-6" aria-hidden="true">
			{Array.from({ length: 2 }).map((_, index) => (
				<div key={index} className="space-y-3">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-4 w-64 max-w-full" />
					<Skeleton className="h-10 w-full max-w-xl" />
				</div>
			))}
		</div>
	);
}
