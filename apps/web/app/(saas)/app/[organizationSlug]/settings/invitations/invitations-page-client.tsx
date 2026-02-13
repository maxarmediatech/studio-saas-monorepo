"use client";

import { Button } from "@repo/ui/components/button";
import { InviteMemberDialog } from "@saas/organizations/components/InviteMemberDialog";
import { OrganizationInvitationsList } from "@saas/organizations/components/OrganizationInvitationsList";
import { Plus } from "lucide-react";
import { useState } from "react";

export function InvitationsPageClient({
	organizationId,
}: {
	organizationId: string;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<>
			<div className="mb-4 flex justify-end">
				<Button size="sm" onClick={() => setDialogOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Invite Member
				</Button>
			</div>

			<InviteMemberDialog
				organizationId={organizationId}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>

			<OrganizationInvitationsList
				organizationId={organizationId}
				onInvite={() => setDialogOpen(true)}
			/>
		</>
	);
}
