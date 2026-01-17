import { SearchPageClient } from "@saas/studio/components/search";
import { Suspense } from "react";

interface SearchPageProps {
	params: Promise<{
		organizationSlug: string;
	}>;
}

export default async function SearchPage({ params }: SearchPageProps) {
	const { organizationSlug } = await params;

	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center">
					<div className="text-sm text-neutral-500">
						Loading search...
					</div>
				</div>
			}
		>
			<SearchPageClient organizationSlug={organizationSlug} />
		</Suspense>
	);
}
