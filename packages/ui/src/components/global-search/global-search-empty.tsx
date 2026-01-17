import { SearchIcon } from "lucide-react";

interface GlobalSearchEmptyProps {
	query: string;
}

export function GlobalSearchEmpty({ query }: GlobalSearchEmptyProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
				<SearchIcon className="h-6 w-6 text-muted-foreground" />
			</div>
			<p className="mt-4 text-sm font-medium">No results found</p>
			<p className="mt-1 text-sm text-muted-foreground">
				No results for "{query}". Try a different search term.
			</p>
		</div>
	);
}
