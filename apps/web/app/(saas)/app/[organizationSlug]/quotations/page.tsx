import { Button } from "@repo/ui/components/button";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { QuotationsList } from "@saas/studio/components/quotations/QuotationsList";
import { resolveStudioAccess } from "@saas/studio/lib/resolve-studio-access.server";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);
	return { title: `Quotations | ${organization?.name ?? "Studio"}` };
}

export default async function QuotationsPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	const [organization, session] = await Promise.all([
		getActiveOrganization(organizationSlug),
		getSession(),
	]);
	if (!organization || !session) {
		notFound();
	}
	const access = await resolveStudioAccess(organization, session);
	return (
		<PageContent
			title="Quotations"
			controls={
				access.caps.quoteCreate ? (
					<Button asChild size="sm">
						<Link href={`/app/${organizationSlug}/quotations/new`}>
							<PlusIcon data-icon="inline-start" />
							New quotation
						</Link>
					</Button>
				) : undefined
			}
		>
			<QuotationsList organizationSlug={organizationSlug} />
		</PageContent>
	);
}
