"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";
import { UserAvatar } from "@shared/components/UserAvatar";
import {
	fullOrganizationQueryKey,
	teamMembersQueryKey,
	useTeamMembersQuery,
} from "@saas/organizations/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface TeamMembersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	organizationId: string;
	team?: {
		id: string;
		name: string;
	};
	members: Array<{
		id: string;
		userId: string;
		user?: {
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	}>;
	canManage: boolean;
}

export function TeamMembersDialog({
	open,
	onOpenChange,
	organizationId,
	team,
	members,
	canManage,
}: TeamMembersDialogProps) {
	const queryClient = useQueryClient();
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

	const { data: teamMembers, isLoading } = useTeamMembersQuery(team?.id ?? "", {
		enabled: open && Boolean(team?.id),
	});

	const currentUserIds = useMemo(
		() => new Set(teamMembers?.map((member) => member.userId) ?? []),
		[teamMembers],
	);

	useEffect(() => {
		if (open) {
			setSelectedUserIds(Array.from(currentUserIds));
		}
	}, [currentUserIds, open]);

	const toggleMember = (userId: string, checked: boolean) => {
		setSelectedUserIds((current) =>
			checked
				? [...current, userId]
				: current.filter((id) => id !== userId),
		);
	};

	const handleSave = () => {
		if (!team?.id) {
			return;
		}

		const nextIds = new Set(selectedUserIds);
		const toAdd = selectedUserIds.filter(
			(userId) => !currentUserIds.has(userId),
		);
		const toRemove = Array.from(currentUserIds).filter(
			(userId) => !nextIds.has(userId),
		);

		if (toAdd.length === 0 && toRemove.length === 0) {
			onOpenChange(false);
			return;
		}

		toast.promise(
			async () => {
				await Promise.all([
					...toAdd.map(async (userId) => {
						const { error } =
							await authClient.organization.addTeamMember({
								teamId: team.id,
								userId,
							});
						if (error) {
							throw error;
						}
					}),
					...toRemove.map(async (userId) => {
						const { error } =
							await authClient.organization.removeTeamMember({
								teamId: team.id,
								userId,
							});
						if (error) {
							throw error;
						}
					}),
				]);
			},
			{
				loading: "Updating team members...",
				success: () => {
					queryClient.invalidateQueries({
						queryKey: teamMembersQueryKey(team.id),
					});
					queryClient.invalidateQueries({
						queryKey: fullOrganizationQueryKey(organizationId),
					});
					onOpenChange(false);
					return "Team members updated";
				},
				error: "Failed to update team members",
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>{team?.name ?? "Team"} members</DialogTitle>
					<DialogDescription>
						Select who should belong to this team.
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 4 }).map((_, index) => (
							<Skeleton key={index} className="h-10 w-full" />
						))}
					</div>
				) : (
					<ScrollArea className="max-h-[320px] pr-2">
						<div className="space-y-2">
							{members.map((member) => {
								const memberName =
									member.user?.name ?? member.user?.email ?? "Member";
								const memberEmail = member.user?.email ?? "";
								const isChecked = selectedUserIds.includes(
									member.userId,
								);

								return (
									<label
										key={member.id}
										htmlFor={`team-member-${member.id}`}
										className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
									>
										<div className="flex items-center gap-3">
											<UserAvatar
												name={memberName}
												avatarUrl={member.user?.image}
											/>
											<div>
												<p className="text-sm font-medium">
													{memberName}
												</p>
												<p className="text-xs text-muted-foreground">
													{memberEmail}
												</p>
											</div>
										</div>
										<Checkbox
											id={`team-member-${member.id}`}
											checked={isChecked}
											onCheckedChange={(checked) =>
												toggleMember(member.userId, Boolean(checked))
											}
											disabled={!canManage}
										/>
									</label>
								);
							})}
						</div>
					</ScrollArea>
				)}

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					{canManage && (
						<Button onClick={handleSave}>Save changes</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
