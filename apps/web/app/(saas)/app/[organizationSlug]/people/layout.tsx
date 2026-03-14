import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { PeopleActions } from "@saas/studio/components/crews/PeopleActions";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
	params: Promise<{ organizationSlug: string }>;
};

export default async function PeopleLayout({ children, params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return (
		<PageContent
			title="People"
			controls={
				organization ? (
					<PeopleActions organizationId={organization.id} />
				) : null
			}
		>
			{children}
		</PageContent>
	);
}
