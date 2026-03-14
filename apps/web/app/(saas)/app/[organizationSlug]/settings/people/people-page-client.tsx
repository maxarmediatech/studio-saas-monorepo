"use client";

import { CrewsFilters } from "@saas/studio";
import { CrewsTableClient } from "@saas/studio/components/crews/CrewsTableClient";
import { PeopleActions } from "@saas/studio/components/crews/PeopleActions";
import { SettingsHeaderPortal } from "../_components/settings-header-portal";

interface PeoplePageClientProps {
	organizationId: string;
	organizationSlug: string;
}

export function PeoplePageClient({
	organizationId,
	organizationSlug,
}: PeoplePageClientProps) {
	return (
		<>
			<SettingsHeaderPortal>
				<PeopleActions organizationId={organizationId} />
			</SettingsHeaderPortal>

			<div className="space-y-4">
				<CrewsFilters />
				<CrewsTableClient
					organizationId={organizationId}
					organizationSlug={organizationSlug}
				/>
			</div>
		</>
	);
}
