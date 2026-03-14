"use client";

import { Button } from "@repo/ui/components/button";
import { InviteMemberDialog } from "@saas/organizations/components/InviteMemberDialog";
import { OrganizationInvitationsList } from "@saas/organizations/components/OrganizationInvitationsList";
import { Plus } from "lucide-react";
import { useState } from "react";
import { SettingsHeaderPortal } from "../_components/settings-header-portal";

export function InvitationsPageClient({
	organizationId,
}: {
	organizationId: string;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<>
			<SettingsHeaderPortal>
				<Button size="sm" onClick={() => setDialogOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Invite Internal Member
				</Button>
			</SettingsHeaderPortal>

			<InviteMemberDialog
				organizationId={organizationId}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				title="Invite internal member"
				description="Invite an internal teammate. They will appear in People after they accept."
				submitLabel="Send invite"
			/>

			<OrganizationInvitationsList
				organizationId={organizationId}
				onInvite={() => setDialogOpen(true)}
			/>
		</>
	);
}
