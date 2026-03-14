"use client";

import { Button } from "@repo/ui/components/button";
import { InviteMemberDialog } from "@saas/organizations/components/InviteMemberDialog";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { PlusIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";

export function PeopleActions({ organizationId }: { organizationId: string }) {
	const { openCreate } = useCrewParams();
	const [inviteOpen, setInviteOpen] = useState(false);

	return (
		<>
			<div className="flex items-center gap-2">
				<Button size="sm" onClick={() => setInviteOpen(true)}>
					<UserPlusIcon className="mr-2 h-4 w-4" />
					Invite Member
				</Button>
				<Button size="sm" variant="outline" onClick={openCreate}>
					<PlusIcon className="mr-2 h-4 w-4" />
					Add Crew
				</Button>
			</div>

			<InviteMemberDialog
				organizationId={organizationId}
				open={inviteOpen}
				onOpenChange={setInviteOpen}
				title="Invite member"
				description="Invite a member. They will appear in People after they accept."
				submitLabel="Send invite"
			/>
		</>
	);
}
