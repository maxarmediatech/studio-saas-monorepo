"use client";

import { authClient } from "@repo/auth/client";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { TeamDialog } from "@saas/organizations/components/team-dialog";
import { TeamMembersDialog } from "@saas/organizations/components/team-members-dialog";
import {
	fullOrganizationQueryKey,
	teamMembersQueryKey,
	useFullOrganizationQuery,
	useTeamMembersQuery,
} from "@saas/organizations/lib/api";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, Trash2Icon, UserPlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface TeamDetailPageClientProps {
	organizationId: string;
	organizationSlug: string;
	teamId: string;
	canManage: boolean;
}

export function TeamDetailPageClient({
	organizationId,
	organizationSlug,
	teamId,
	canManage,
}: TeamDetailPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();

	const { data: organization } = useFullOrganizationQuery(organizationId);
	const team = useMemo(
		() => organization?.teams?.find((t) => t.id === teamId),
		[organization?.teams, teamId],
	);

	const { data: teamMembers, isLoading: membersLoading } = useTeamMembersQuery(teamId);

	// Cross-reference team member userIds with org members for names/emails
	const resolvedMembers = useMemo(() => {
		if (!teamMembers || !organization?.members) return [];
		const orgMemberMap = new Map(
			organization.members.map((m) => [m.userId, m]),
		);
		return teamMembers.map((tm) => {
			const orgMember = orgMemberMap.get(tm.userId);
			return {
				...tm,
				name: orgMember?.user?.name ?? orgMember?.user?.email ?? "Member",
				email: orgMember?.user?.email ?? "",
				image: orgMember?.user?.image ?? null,
			};
		});
	}, [teamMembers, organization?.members]);

	// Dialogs
	const [renameOpen, setRenameOpen] = useState(false);
	const [membersDialogOpen, setMembersDialogOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	// Rename mutation
	const renameMutation = useMutation({
		mutationFn: async (name: string) => {
			const { error } = await authClient.organization.updateTeam({
				teamId,
				data: { name },
			});
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: fullOrganizationQueryKey(organizationId),
			});
			toast.success("Team renamed");
			setRenameOpen(false);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to rename team");
		},
	});

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: async () => {
			const { error } = await authClient.organization.removeTeam({
				teamId,
				organizationId,
			});
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: fullOrganizationQueryKey(organizationId),
			});
			queryClient.invalidateQueries({
				queryKey: teamMembersQueryKey(teamId),
			});
			toast.success("Team deleted");
			router.push(`/app/${organizationSlug}/settings/teams`);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to delete team");
		},
	});

	// Remove single member mutation
	const removeMemberMutation = useMutation({
		mutationFn: async (userId: string) => {
			const { error } = await authClient.organization.removeTeamMember({
				teamId,
				userId,
			});
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: teamMembersQueryKey(teamId),
			});
			queryClient.invalidateQueries({
				queryKey: fullOrganizationQueryKey(organizationId),
			});
			toast.success("Member removed");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to remove member");
		},
	});

	if (!team) {
		return (
			<div className="px-4 py-16 text-center text-sm text-muted-foreground lg:px-6">
				Team not found.
			</div>
		);
	}

	return (
		<>
			<SettingsList>
				{/* Team Name */}
				<SettingsItem
					title="Team Name"
					description="The display name for this team."
				>
					<div className="flex items-center justify-between rounded-lg border px-4 py-3">
						<span className="text-sm font-medium">{team.name}</span>
						{canManage && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setRenameOpen(true)}
							>
								<PencilIcon className="mr-2 h-4 w-4" />
								Rename
							</Button>
						)}
					</div>
				</SettingsItem>

				{/* Members */}
				<SettingsItem
					title="Members"
					description="People who belong to this team."
				>
					<div className="space-y-3">
						{canManage && (
							<div className="flex justify-end">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setMembersDialogOpen(true)}
								>
									<UserPlusIcon className="mr-2 h-4 w-4" />
									Manage Members
								</Button>
							</div>
						)}

						{membersLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 3 }).map((_, i) => (
									<Skeleton key={i} className="h-14 w-full rounded-lg" />
								))}
							</div>
						) : resolvedMembers.length === 0 ? (
							<div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
								No members yet. Add members to this team to get started.
							</div>
						) : (
							<div className="divide-y rounded-lg border">
								{resolvedMembers.map((member) => (
									<div
										key={member.userId}
										className="flex items-center justify-between px-4 py-3"
									>
										<div className="flex items-center gap-3">
											<UserAvatar
												name={member.name}
												avatarUrl={member.image}
											/>
											<div>
												<p className="text-sm font-medium">
													{member.name}
												</p>
												{member.email && (
													<p className="text-xs text-muted-foreground">
														{member.email}
													</p>
												)}
											</div>
										</div>
										{canManage && (
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-destructive"
												onClick={() =>
													removeMemberMutation.mutate(member.userId)
												}
												disabled={removeMemberMutation.isPending}
											>
												<XIcon className="h-4 w-4" />
											</Button>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</SettingsItem>

				{/* Danger Zone */}
				{canManage && (
					<SettingsItem
						title="Danger Zone"
						description="Irreversible actions for this team."
						danger
					>
						<div className="rounded-lg border border-destructive/30 px-4 py-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">Delete this team</p>
									<p className="text-xs text-muted-foreground">
										This will remove the team and all memberships. This
										action cannot be undone.
									</p>
								</div>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => setDeleteConfirmOpen(true)}
								>
									<Trash2Icon className="mr-2 h-4 w-4" />
									Delete Team
								</Button>
							</div>
						</div>
					</SettingsItem>
				)}
			</SettingsList>

			{/* Rename dialog */}
			<TeamDialog
				open={renameOpen}
				onOpenChange={setRenameOpen}
				mode="edit"
				defaultName={team.name}
				isSaving={renameMutation.isPending}
				onSave={(name) => renameMutation.mutate(name)}
			/>

			{/* Manage members dialog */}
			{organization?.members && (
				<TeamMembersDialog
					open={membersDialogOpen}
					onOpenChange={setMembersDialogOpen}
					organizationId={organizationId}
					team={{ id: teamId, name: team.name }}
					members={organization.members}
					canManage={canManage}
				/>
			)}

			{/* Delete confirmation */}
			<AlertDialog
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete team?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove &quot;{team.name}&quot; and all team memberships.
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={deleteMutation.isPending}
							onClick={() => deleteMutation.mutate()}
						>
							Delete team
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
