"use client";

import { Button } from "@repo/ui/components/button";
import { InviteMemberDialog } from "@saas/organizations/components/InviteMemberDialog";
import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
import { Plus } from "lucide-react";
import { useState } from "react";
import { SettingsHeaderPortal } from "../_components/settings-header-portal";

interface MembersPageClientProps {
	organizationId: string;
	canManage: boolean;
}

export function MembersPageClient({
	organizationId,
	canManage,
}: MembersPageClientProps) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<>
			{canManage && (
				<SettingsHeaderPortal>
					<Button size="sm" onClick={() => setDialogOpen(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Invite Member
					</Button>
				</SettingsHeaderPortal>
			)}

			<OrganizationMembersBlock organizationId={organizationId} />

			<InviteMemberDialog
				organizationId={organizationId}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</>
	);
}
