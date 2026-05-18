import { WhatsAppDashboardPageClient } from "@saas/studio";
import { PageContent } from "@saas/studio/components/PageContent";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function MessageDashboardPage({ params }: Props) {
	const { organizationSlug } = await params;

	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/messages/dashboard"),
		))
	) {
		notFound();
	}

	return (
		<PageContent
			title="WhatsApp Dashboard"
			contentClassName="bg-background"
		>
			<WhatsAppDashboardPageClient />
		</PageContent>
	);
}
