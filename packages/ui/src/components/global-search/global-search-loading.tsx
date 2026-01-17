import { Loader2Icon } from "lucide-react";

export function GlobalSearchLoading() {
	return (
		<div className="flex flex-col items-center justify-center py-12">
			<Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
			<p className="mt-2 text-sm text-muted-foreground">Searching...</p>
		</div>
	);
}
