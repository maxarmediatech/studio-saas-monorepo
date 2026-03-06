"use client";

import { authClient } from "@repo/auth/client";
import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import {
	coerceOrganizationRoles,
	hasAnyRole,
} from "@repo/auth/lib/permissions";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { useSession } from "@saas/auth/hooks/use-session";
import { useAllRoles } from "@saas/organizations/hooks/use-all-roles";
import {
	fullOrganizationQueryKey,
	useFullOrganizationQuery,
} from "@saas/organizations/lib/api";
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
import { crewsApi } from "@saas/studio/lib/api";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { LogOutIcon, TrashIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AddToCrewDialog } from "./AddToCrewDialog";
import { MemberRolesDialog } from "./member-roles-dialog";

export function OrganizationMembersList({
	organizationId,
}: {
	organizationId: string;
}) {
	type UpdateRoleInput = Parameters<
		typeof authClient.organization.updateMemberRole
	>[0]["role"];
	const t = useTranslations();
	const queryClient = useQueryClient();
	const { user } = useSession();
	const { data: organization } = useFullOrganizationQuery(organizationId);
	const userIsOrganizationAdmin = isOrganizationAdmin(organization, user);
	const {
		filters,
		pagination,
		setFilter,
		setPage,
		onPaginationChange,
		onLimitChange,
		sortingState,
		onSortingChange,
	} = useDataTable();
	const { getRoleLabel } = useAllRoles({
		enabled: userIsOrganizationAdmin,
	});

	const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
	const [selectedMember, setSelectedMember] = useState<{
		memberId: string;
		name: string;
		email: string;
		roles: string[];
	} | null>(null);

	// Dialog state for adding member to crew
	const [addToCrewDialogOpen, setAddToCrewDialogOpen] = useState(false);
	const [selectedMemberForCrew, setSelectedMemberForCrew] = useState<{
		memberId: string;
		memberName: string;
	} | null>(null);

	// Fetch crews to check which members have crew profiles
	const { data: crewsData } = useQuery({
		...crewsApi.listOptions({ limit: 100 }),
	});

	// Get set of user IDs that have crew profiles
	const userIdsWithCrewProfiles = useMemo(
		() =>
			new Set(
				crewsData?.data?.filter((c) => c.userId).map((c) => c.userId) ??
					[],
			),
		[crewsData],
	);

	const handleAddToCrew = (memberId: string, memberName: string) => {
		setSelectedMemberForCrew({ memberId, memberName });
		setAddToCrewDialogOpen(true);
	};

	const handleAddToCrewSuccess = () => {
		setAddToCrewDialogOpen(false);
		setSelectedMemberForCrew(null);
		queryClient.invalidateQueries({ queryKey: orpc.crews.key() });
	};

	const updateMemberRole = async (memberId: string, role: string[]) => {
		toast.promise(
			async () => {
				const roleInput = role as UpdateRoleInput;
				const { error } =
					await authClient.organization.updateMemberRole({
						memberId,
						role: roleInput,
						organizationId,
					});
				if (error) {
					throw error;
				}
			},
			{
				loading: t(
					"organizations.settings.members.notifications.updateMembership.loading.description",
				),
				success: () => {
					queryClient.invalidateQueries({
						queryKey: fullOrganizationQueryKey(organizationId),
					});

					return t(
						"organizations.settings.members.notifications.updateMembership.success.description",
					);
				},
				error: t(
					"organizations.settings.members.notifications.updateMembership.error.description",
				),
			},
		);
	};

	const removeMember = async (memberId: string) => {
		toast.promise(
			async () => {
				await authClient.organization.removeMember({
					memberIdOrEmail: memberId,
					organizationId,
				});
			},
			{
				loading: t(
					"organizations.settings.members.notifications.removeMember.loading.description",
				),
				success: () => {
					queryClient.invalidateQueries({
						queryKey: fullOrganizationQueryKey(organizationId),
					});

					return t(
						"organizations.settings.members.notifications.removeMember.success.description",
					);
				},
				error: t(
					"organizations.settings.members.notifications.removeMember.error.description",
				),
			},
		);
	};

	const handleOpenRolesDialog = (member: {
		id: string;
		name: string | null;
		email: string;
		roles: string[];
	}) => {
		setSelectedMember({
			memberId: member.id,
			name: member.name ?? member.email,
			email: member.email,
			roles: member.roles,
		});
		setRolesDialogOpen(true);
	};

	type MemberRow = {
		id: string;
		userId: string;
		name: string;
		email: string;
		avatarUrl?: string | null;
		roles: string[];
		canUpdateRoles: boolean;
		hasCrewProfile: boolean;
	};

	const memberRows = useMemo<MemberRow[]>(() => {
		return (
			organization?.members?.map((member) => {
				const roleKeys = coerceOrganizationRoles(member.role);
				const hasCrewProfile = userIdsWithCrewProfiles.has(
					member.userId,
				);
				const canUpdateRoles =
					userIsOrganizationAdmin &&
					!hasAnyRole(member.role, ["owner"]);

				return {
					id: member.id,
					userId: member.userId,
					name: member.user?.name ?? member.user?.email ?? "Member",
					email: member.user?.email ?? "",
					avatarUrl: member.user?.image ?? null,
					roles: roleKeys,
					canUpdateRoles,
					hasCrewProfile,
				};
			}) ?? []
		);
	}, [
		organization?.members,
		userIdsWithCrewProfiles,
		userIsOrganizationAdmin,
	]);

	const filteredRows = useMemo(() => {
		const query = filters.search?.trim().toLowerCase();
		if (!query) {
			return memberRows;
		}

		return memberRows.filter((member) => {
			if (member.name.toLowerCase().includes(query)) {
				return true;
			}

			if (member.email.toLowerCase().includes(query)) {
				return true;
			}

			return member.roles.some((role) =>
				getRoleLabel(role).toLowerCase().includes(query),
			);
		});
	}, [filters.search, memberRows, getRoleLabel]);

	const sortedRows = useMemo(() => {
		const [sort] = sortingState;
		if (!sort) {
			return filteredRows;
		}

		const nextRows = [...filteredRows].sort((left, right) => {
			let leftValue = "";
			let rightValue = "";

			switch (sort.id) {
				case "name":
					leftValue = left.name;
					rightValue = right.name;
					break;
				case "email":
					leftValue = left.email;
					rightValue = right.email;
					break;
				case "roles":
					leftValue = left.roles.join(", ");
					rightValue = right.roles.join(", ");
					break;
				default:
					return 0;
			}

			const comparison = leftValue.localeCompare(rightValue, undefined, {
				sensitivity: "base",
			});

			return sort.desc ? -comparison : comparison;
		});

		return nextRows;
	}, [filteredRows, sortingState]);

	const total = sortedRows.length;
	const pageCount = Math.max(1, Math.ceil(total / pagination.limit));
	const currentPage = Math.min(pagination.page, pageCount);

	useEffect(() => {
		if (pagination.page !== currentPage) {
			setPage(currentPage);
		}
	}, [currentPage, pagination.page, setPage]);

	const paginatedRows = useMemo(() => {
		const start = (currentPage - 1) * pagination.limit;
		return sortedRows.slice(start, start + pagination.limit);
	}, [currentPage, pagination.limit, sortedRows]);

	const rowActions = useMemo<RowAction<MemberRow>[]>(
		() => [
			{
				label: "Add to Crew",
				icon: <UsersIcon className="h-4 w-4" />,
				onClick: (row) => handleAddToCrew(row.id, row.name),
				show: (row) => !row.hasCrewProfile,
			},
			{
				label: t("organizations.settings.members.removeMember"),
				icon: <TrashIcon className="h-4 w-4" />,
				variant: "destructive",
				separator: true,
				onClick: (row) => removeMember(row.id),
				show: (row) =>
					row.userId !== user?.id && userIsOrganizationAdmin,
			},
			{
				label: t("organizations.settings.members.leaveOrganization"),
				icon: <LogOutIcon className="h-4 w-4" />,
				variant: "destructive",
				separator: true,
				onClick: (row) => removeMember(row.id),
				show: (row) => row.userId === user?.id,
			},
		],
		[handleAddToCrew, removeMember, t, user?.id, userIsOrganizationAdmin],
	);

	const columns = useMemo<ColumnDef<MemberRow>[]>(
		() => [
			createSelectColumn<MemberRow>(),
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<UserAvatar
							name={row.original.name}
							avatarUrl={row.original.avatarUrl}
						/>
						<div className="flex items-center gap-2">
							<span className="font-medium text-foreground">
								{row.original.name}
							</span>
							{row.original.hasCrewProfile && (
								<Badge variant="secondary" className="text-xs">
									Crew
								</Badge>
							)}
						</div>
					</div>
				),
				meta: {
					label: "Name",
					width: 220,
					minWidth: 200,
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "email",
				accessorKey: "email",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Email" />
				),
				cell: ({ row }) => (
					<span className="text-foreground/70 text-sm">
						{row.original.email}
					</span>
				),
				meta: {
					label: "Email",
					width: 240,
					minWidth: 240,
				},
				enableSorting: true,
			},
			{
				id: "roles",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Roles" />
				),
				cell: ({ row }) =>
					row.original.roles.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{row.original.roles.map((roleKey) => (
								<Badge
									key={roleKey}
									variant="outline"
									className="text-xs"
								>
									{getRoleLabel(roleKey)}
								</Badge>
							))}
						</div>
					) : (
						<span className="text-foreground/60 text-sm">—</span>
					),
				meta: {
					label: "Roles",
					width: 260,
					minWidth: 220,
				},
				enableSorting: true,
			},
			{
				id: "actions",
				header: () => <span className="text-right">Actions</span>,
				cell: ({ row }) => (
					<div className="flex items-center justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								handleOpenRolesDialog({
									id: row.original.id,
									name: row.original.name,
									email: row.original.email,
									roles: row.original.roles,
								})
							}
							disabled={!row.original.canUpdateRoles}
						>
							Update roles
						</Button>
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
					width: 220,
					minWidth: 200,
				},
			},
		],
		[getRoleLabel, handleOpenRolesDialog, rowActions],
	);

	return (
		<>
			<DataTableToolbar
				showSearch
				searchValue={filters.search ?? ""}
				searchPlaceholder="Search members..."
				onSearchChange={(value) => {
					setFilter("search", value || null);
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
					{ id: "name", width: 220 },
				]}
				stickyRightColumns={[{ id: "actions", width: 220 }]}
				minWidth={900}
				scrollControlsColumnId="name"
				scrollStartColumn={2}
			/>

			{selectedMember && (
				<MemberRolesDialog
					open={rolesDialogOpen}
					onOpenChange={setRolesDialogOpen}
					member={
						selectedMember
							? {
									name: selectedMember.name,
									email: selectedMember.email,
									roles: selectedMember.roles,
								}
							: undefined
					}
					onSave={(roles) => {
						updateMemberRole(selectedMember.memberId, roles);
					}}
				/>
			)}

			{selectedMemberForCrew && (
				<AddToCrewDialog
					open={addToCrewDialogOpen}
					onOpenChange={setAddToCrewDialogOpen}
					memberId={selectedMemberForCrew.memberId}
					memberName={selectedMemberForCrew.memberName}
					onSuccess={handleAddToCrewSuccess}
				/>
			)}
		</>
	);
}
