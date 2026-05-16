import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

const rows = [
	["Approved", "Ready for first-message sends"],
	["Pending", "Waiting on Meta review"],
	["Rejected", "Needs edits before resubmission"],
] as const;

export default async function MessageTemplatesPage({ params }: Props) {
	const { organizationSlug } = await params;

	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/messages/templates"),
		))
	) {
		notFound();
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="shrink-0 border-b">
				<div className="flex h-16 items-center px-4 lg:px-6">
					<h1 className="text-lg font-semibold text-neutral-900">
						Templates
					</h1>
				</div>
			</header>
			<main className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
				<div className="max-w-3xl rounded-lg border bg-white">
					<div className="border-b p-4">
						<h2 className="text-sm font-medium text-neutral-900">
							Meta templates
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Approved WhatsApp templates for cold-start client
							and crew messages.
						</p>
					</div>
					<div className="divide-y">
						{rows.map(([label, description]) => (
							<div
								key={label}
								className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 p-4 text-sm"
							>
								<div className="font-medium text-neutral-900">
									{label}
								</div>
								<div className="text-muted-foreground">
									{description}
								</div>
							</div>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
