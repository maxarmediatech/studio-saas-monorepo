import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { PeopleActions } from "@saas/studio/components/crews/PeopleActions";
import { type ReactNode, Suspense } from "react";

type Props = {
	children: ReactNode;
	params: Promise<{ organizationSlug: string }>;
};

export default function PeopleLayout({ children, params }: Props) {
	return (
		<PageContent
			title="People"
			controls={
				<Suspense fallback={null}>
					<PeopleControls params={params} />
				</Suspense>
			}
		>
			{children}
		</PageContent>
	);
}

async function PeopleControls({ params }: Pick<Props, "params">) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return organization ? (
		<PeopleActions organizationId={organization.id} />
	) : null;
}
