"use client";

import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
import { PeopleActions } from "@saas/studio/components/crews/PeopleActions";
import { SettingsHeaderPortal } from "../_components/settings-header-portal";

interface MembersPageClientProps {
	organizationId: string;
	canManage: boolean;
}

export function MembersPageClient({
	organizationId,
	canManage,
}: MembersPageClientProps) {
	return (
		<>
			{canManage && (
				<SettingsHeaderPortal>
					<PeopleActions organizationId={organizationId} />
				</SettingsHeaderPortal>
			)}

			<OrganizationMembersBlock organizationId={organizationId} />
		</>
	);
}
