import { WhatsAppTemplatesPageClient } from "@saas/studio";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

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

	return <WhatsAppTemplatesPageClient />;
}
