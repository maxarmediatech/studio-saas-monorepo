import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

const checklist = [
	"WhatsApp Business account",
	"Phone number connection",
	"Webhook callback URL",
	"Webhook verify token",
	"Template review status",
	"Opt-out handling",
] as const;

export default async function MessageSetupPage({ params }: Props) {
	const { organizationSlug } = await params;

	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/messages/setup"),
		))
	) {
		notFound();
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="shrink-0 border-b">
				<div className="flex h-16 items-center px-4 lg:px-6">
					<h1 className="text-lg font-semibold text-neutral-900">
						Setup & Review
					</h1>
				</div>
			</header>
			<main className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
				<div className="max-w-3xl rounded-lg border bg-white">
					<div className="border-b p-4">
						<h2 className="text-sm font-medium text-neutral-900">
							Facebook review checklist
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Production access items for WhatsApp messaging.
						</p>
					</div>
					<div className="divide-y">
						{checklist.map((item) => (
							<div
								key={item}
								className="flex items-center justify-between gap-4 p-4 text-sm"
							>
								<span className="font-medium text-neutral-900">
									{item}
								</span>
								<span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
									Review
								</span>
							</div>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
