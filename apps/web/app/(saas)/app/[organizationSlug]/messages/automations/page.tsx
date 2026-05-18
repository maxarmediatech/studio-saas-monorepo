import { WhatsAppAutomationsPageClient } from "@saas/studio";
import { PageContent } from "@saas/studio/components/PageContent";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function MessageAutomationsPage({ params }: Props) {
	const { organizationSlug } = await params;

	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/messages/automations"),
		))
	) {
		notFound();
	}

	return (
		<PageContent title="Automations" contentClassName="bg-background">
			<WhatsAppAutomationsPageClient />
		</PageContent>
	);
}
