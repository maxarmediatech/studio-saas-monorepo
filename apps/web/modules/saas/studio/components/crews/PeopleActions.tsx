"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { InviteMemberDialog } from "@saas/organizations/components/InviteMemberDialog";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import {
	ChevronDownIcon,
	PlusIcon,
	UserPlusIcon,
	UsersIcon,
} from "lucide-react";
import { useState } from "react";

export function PeopleActions({
	organizationId,
	buttonLabel = "Add Person",
}: {
	organizationId: string;
	buttonLabel?: string;
}) {
	const { openCreate } = useCrewParams();
	const [inviteOpen, setInviteOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="sm">
						<PlusIcon className="mr-2 h-4 w-4" />
						{buttonLabel}
						<ChevronDownIcon className="ml-2 h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => setInviteOpen(true)}>
						<UserPlusIcon className="mr-2 h-4 w-4" />
						Invite Member
					</DropdownMenuItem>
					<DropdownMenuItem onClick={openCreate}>
						<UsersIcon className="mr-2 h-4 w-4" />
						Add Contractual Person
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

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
