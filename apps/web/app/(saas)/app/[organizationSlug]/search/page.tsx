import { SearchPageClient } from "@saas/studio/components/search";
import type { Metadata } from "next";
import { Suspense } from "react";

interface SearchPageProps {
	params: Promise<{
		organizationSlug: string;
	}>;
}

export const metadata: Metadata = {
	title: "Search",
};

export default function SearchPage({ params }: SearchPageProps) {
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
			<SearchContent params={params} />
		</Suspense>
	);
}

async function SearchContent({ params }: SearchPageProps) {
	const { organizationSlug } = await params;

	return <SearchPageClient organizationSlug={organizationSlug} />;
}
