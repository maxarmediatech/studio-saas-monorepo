"use client";

import { authClient } from "@repo/auth/client";
import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { Button } from "@repo/ui/components/button";
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
import {
	createSelectColumn,
	DataTable,
	DataTableColumnHeader,
	DataTableRowActions,
	DataTableToolbar,
	type RowAction,
} from "@saas/shared/components/data-table";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { useDataTable } from "@saas/shared/hooks/use-data-table";
import { orpcClient } from "@shared/lib/orpc-client";
import { UserAvatar } from "@shared/components/UserAvatar";
import {
	fullOrganizationQueryKey,
	teamMembersQueryKey,
	useFullOrganizationQuery,
} from "@saas/organizations/lib/api";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { PencilIcon, TrashIcon, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TeamDialog } from "./team-dialog";
import { TeamMembersDialog } from "./team-members-dialog";
import { useSession } from "@saas/auth/hooks/use-session";

interface OrganizationTeamsListProps {
	organizationId: string;
}

interface TeamRow {
	id: string;
	name: string;
	membersCount: number;
	createdAt?: Date | null;
	updatedAt?: Date | null;
}

export function OrganizationTeamsList({
	organizationId,
}: OrganizationTeamsListProps) {
	const queryClient = useQueryClient();
	const { user } = useSession();
	const { data: organization } = useFullOrganizationQuery(organizationId);
	const canManageTeams = isOrganizationAdmin(organization, user);

	const teams = organization?.teams ?? [];

	const teamMemberQueries = useQueries({
		queries: teams.map((team) => ({
			queryKey: teamMembersQueryKey(team.id),
			queryFn: async () => {
				return await orpcClient.organizations.teams.listMembers({
					teamId: team.id,
				});
			},
		})),
	});

	const teamMemberCounts = useMemo(() => {
		const counts = new Map<string, number>();
		teams.forEach((team, index) => {
			const members = teamMemberQueries[index]?.data ?? [];
			counts.set(team.id, members.length);
		});
		return counts;
	}, [teams, teamMemberQueries]);

	const teamRows = useMemo<TeamRow[]>(() => {
		return teams.map((team) => ({
			id: team.id,
			name: team.name,
			membersCount: teamMemberCounts.get(team.id) ?? 0,
			createdAt: team.createdAt ?? null,
			updatedAt: team.updatedAt ?? null,
		}));
	}, [teams, teamMemberCounts]);

	const {
		filters,
		pagination,
		setFilter,
		setPage,
		onPaginationChange,
		onLimitChange,
		sortingState,
		onSortingChange,
	} = useDataTable({
		defaultSortBy: "name",
		defaultSortDirection: "asc",
	});

	const filteredRows = useMemo(() => {
		const query = filters.search?.trim().toLowerCase();
		if (!query) {
			return teamRows;
		}

		return teamRows.filter((team) =>
			team.name.toLowerCase().includes(query),
		);
	}, [filters.search, teamRows]);

	const sortedRows = useMemo(() => {
		const [sort] = sortingState;
		if (!sort) {
			return filteredRows;
		}

		const nextRows = [...filteredRows].sort((left, right) => {
			let leftValue: string | number = "";
			let rightValue: string | number = "";

			switch (sort.id) {
				case "name":
					leftValue = left.name;
					rightValue = right.name;
					break;
				case "members":
					leftValue = left.membersCount;
					rightValue = right.membersCount;
					break;
				default:
					return 0;
			}

			if (typeof leftValue === "number" && typeof rightValue === "number") {
				const comparison = leftValue - rightValue;
				return sort.desc ? -comparison : comparison;
			}

			const comparison = String(leftValue).localeCompare(
				String(rightValue),
				undefined,
				{ sensitivity: "base" },
			);

			return sort.desc ? -comparison : comparison;
		});

		return nextRows;
	}, [filteredRows, sortingState]);

	const total = sortedRows.length;
	const pageCount = Math.max(1, Math.ceil(total / pagination.limit));
	const currentPage = Math.min(pagination.page, pageCount);

	const paginatedRows = useMemo(() => {
		const start = (currentPage - 1) * pagination.limit;
		return sortedRows.slice(start, start + pagination.limit);
	}, [currentPage, pagination.limit, sortedRows]);

	const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
	const [membersTeam, setMembersTeam] = useState<TeamRow | null>(null);
	const [teamToDelete, setTeamToDelete] = useState<TeamRow | null>(null);

	const updateTeamMutation = useMutation({
		mutationFn: async ({ teamId, name }: { teamId: string; name: string }) => {
			const { error } = await authClient.organization.updateTeam({
				teamId,
				data: {
					name,
				},
			});
			if (error) {
				throw error;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: fullOrganizationQueryKey(organizationId),
			});
			toast.success("Team updated");
			setEditingTeam(null);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to update team");
		},
	});

	const deleteTeamMutation = useMutation({
		mutationFn: async (teamId: string) => {
			const { error } = await authClient.organization.removeTeam({
				teamId,
				organizationId,
			});
			if (error) {
				throw error;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: fullOrganizationQueryKey(organizationId),
			});
			if (teamToDelete) {
				queryClient.invalidateQueries({
					queryKey: teamMembersQueryKey(teamToDelete.id),
				});
			}
			toast.success("Team deleted");
			setTeamToDelete(null);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to delete team");
		},
	});

	const rowActions = useMemo<RowAction<TeamRow>[]>(
		() => [
			{
				label: "Manage members",
				icon: <UsersIcon className="h-4 w-4" />,
				onClick: (row) => setMembersTeam(row),
				show: () => canManageTeams,
			},
			{
				label: "Rename",
				icon: <PencilIcon className="h-4 w-4" />,
				onClick: (row) => setEditingTeam(row),
				show: () => canManageTeams,
			},
			{
				label: "Delete",
				icon: <TrashIcon className="h-4 w-4" />,
				variant: "destructive",
				separator: true,
				onClick: (row) => setTeamToDelete(row),
				show: () => canManageTeams,
			},
		],
		[canManageTeams],
	);

	const columns = useMemo<ColumnDef<TeamRow>[]>(
		() => [
			createSelectColumn<TeamRow>(),
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Team" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<UserAvatar name={row.original.name} />
						<span className="font-medium text-foreground">
							{row.original.name}
						</span>
					</div>
				),
				meta: {
					label: "Team",
					width: 260,
					minWidth: 220,
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "members",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Members" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-foreground/70">
						{row.original.membersCount} members
					</span>
				),
				meta: {
					label: "Members",
					width: 160,
					minWidth: 140,
				},
				enableSorting: true,
			},
			{
				id: "actions",
				header: () => <span className="text-right">Actions</span>,
				cell: ({ row }) => (
					<div className="flex items-center justify-end">
						<DataTableRowActions
							row={row.original}
							actions={rowActions}
						/>
					</div>
				),
				enableSorting: false,
				meta: {
					label: "Actions",
					headerClassName: "text-right",
					cellClassName: "text-right",
					width: 120,
					minWidth: 100,
				},
			},
		],
		[rowActions],
	);

	return (
		<>
			<DataTableToolbar
				showSearch
				searchValue={filters.search ?? ""}
				searchPlaceholder="Search teams..."
				onSearchChange={(value) => {
					setFilter("search", value || null);
					setPage(1);
				}}
				showViewOptions={false}
				className="mb-4"
			/>
			<DataTable
				columns={columns}
				data={paginatedRows}
				getRowId={(row) => row.id}
				enableRowSelection
				sorting={sortingState}
				onSortingChange={onSortingChange}
				pagination={{
					page: currentPage,
					limit: pagination.limit,
					total,
					pageCount,
				}}
				onPaginationChange={onPaginationChange}
				onLimitChange={onLimitChange}
				stickyLeftColumns={[
					{ id: "select", width: 48 },
					{ id: "name", width: 260 },
				]}
				stickyRightColumns={[{ id: "actions", width: 120 }]}
				minWidth={680}
				scrollControlsColumnId="name"
				scrollStartColumn={2}
				emptyState={
					<div className="py-8 text-center text-sm text-muted-foreground">
						No teams yet.
					</div>
				}
			/>

			{editingTeam && (
				<TeamDialog
					open={Boolean(editingTeam)}
					onOpenChange={(open) =>
						setEditingTeam(open ? editingTeam : null)
					}
					mode="edit"
					defaultName={editingTeam.name}
					isSaving={updateTeamMutation.isPending}
					onSave={(name) =>
						updateTeamMutation.mutate({
							teamId: editingTeam.id,
							name,
						})
					}
				/>
			)}

			{membersTeam && organization?.members && (
				<TeamMembersDialog
					open={Boolean(membersTeam)}
					onOpenChange={(open) =>
						setMembersTeam(open ? membersTeam : null)
					}
					organizationId={organizationId}
					team={{ id: membersTeam.id, name: membersTeam.name }}
					members={organization.members}
					canManage={canManageTeams}
				/>
			)}

			<AlertDialog
				open={Boolean(teamToDelete)}
				onOpenChange={(open) => {
					if (!open) {
						setTeamToDelete(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete team?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove the team and all team memberships. This
							action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={deleteTeamMutation.isPending}
							onClick={() => {
								if (teamToDelete) {
									deleteTeamMutation.mutate(teamToDelete.id);
								}
							}}
						>
							Delete team
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
