"use client";

import type { Crew } from "@repo/api/modules/studio/schemas/crew";
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
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { InviteMemberDialog } from "@saas/organizations/components/InviteMemberDialog";
import {
	createSelectColumn,
	DataTable,
	DataTableColumnHeader,
	DataTableRowActions,
	DataTableViewOptions,
	type RowAction,
	SortProvider,
} from "@saas/shared/components/data-table";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { formatMoney } from "@saas/shared/lib";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { useCrewsTable } from "@saas/studio/hooks/tables";
import {
	configurationsApi,
	crewsApi,
	crewsMutations,
} from "@saas/studio/lib/api";
import { getWorkerTypeLabel } from "@saas/studio/lib/people";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	EyeIcon,
	Loader2Icon,
	PencilIcon,
	PhoneIcon,
	TrashIcon,
	UserCheckIcon,
	UserIcon,
	UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenCrewCreateSheet } from "./OpenCrewSheet";

// Note: organizationSlug kept for future crew detail page navigation
interface CrewsTableClientProps {
	organizationSlug?: string;
	organizationId?: string;
}

const statusColors: Record<string, string> = {
	active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	inactive:
		"bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
	unavailable:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const statusOptions = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "unavailable", label: "Unavailable" },
];

export function CrewsTableClient({
	organizationSlug,
	organizationId,
}: CrewsTableClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();

	// Use the crews table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		columnVisibility,
		onColumnVisibilityChange,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useCrewsTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [crewToDelete, setCrewToDelete] = useState<Crew | null>(null);
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
	const [crewToInvite, setCrewToInvite] = useState<Crew | null>(null);

	// URL-based sheet params
	const { openEdit } = useCrewParams();
	const workerType = filters.workerType?.filter(
		(value): value is "internal" | "freelancer" =>
			value === "internal" || value === "freelancer",
	);
	const activeWorkerType = workerType?.[0] ?? "all";
	const hasAppAccess = filters.hasAppAccess?.filter(
		(value): value is "true" | "false" =>
			value === "true" || value === "false",
	);

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		status: filters.status ?? undefined,
		specializations: filters.specializations ?? undefined,
		workerType:
			workerType && workerType.length > 0 ? workerType : undefined,
		hasAppAccess:
			hasAppAccess && hasAppAccess.length > 0 ? hasAppAccess : undefined,
		sortBy: sorting.sortBy ?? "name",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch crews with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		crewsApi.listOptions(queryInput),
	);
	const { data: specializationData } = useQuery(
		configurationsApi.specialisationsOptions(),
	);
	const specializationLabelMap = useMemo(
		() =>
			new Map(
				(specializationData?.data ?? []).map((item) => [
					item.key,
					item.label,
				]),
			),
		[specializationData?.data],
	);

	const crews = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...crewsMutations.delete(),
		onSuccess: () => {
			toast.success("Person deleted successfully");
			setDeleteDialogOpen(false);
			setCrewToDelete(null);
			queryClient.invalidateQueries({
				queryKey: orpc.crews.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete person");
		},
	});

	const handleOpenEdit = (crew: Crew) => {
		openEdit(crew.id);
	};

	// Define row actions
	const rowActions: RowAction<Crew>[] = useMemo(
		() => [
			{
				label: "View details",
				icon: <EyeIcon className="h-4 w-4" />,
				onClick: (row) =>
					router.push(`/app/${organizationSlug}/people/${row.id}`),
			},
			{
				label: "Edit",
				icon: <PencilIcon className="h-4 w-4" />,
				onClick: handleOpenEdit,
			},
			{
				label: "Invite to App",
				icon: <UserPlusIcon className="h-4 w-4" />,
				onClick: (row) => {
					setCrewToInvite(row);
					setInviteDialogOpen(true);
				},
				show: (row) =>
					Boolean(organizationId) &&
					!row.hasAppAccess &&
					Boolean(row.email),
			},
			{
				label: "Delete",
				icon: <TrashIcon className="h-4 w-4" />,
				variant: "destructive",
				separator: true,
				onClick: (row) => {
					setCrewToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[organizationId, organizationSlug, router],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<Crew>[] = useMemo(
		() => [
			createSelectColumn<Crew>(),
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => (
					<Link
						href={`/app/${organizationSlug}/people/${row.original.id}`}
						className="font-medium text-foreground hover:underline"
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: "Name",
					width: 200,
					minWidth: 150,
					// Last left-sticky column - add right border
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "workerType",
				accessorKey: "workerType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Type" />
				),
				cell: ({ row }) => (
					<Badge variant="outline">
						{getWorkerTypeLabel(row.original.workerType)}
					</Badge>
				),
				meta: {
					label: "Type",
					width: 120,
					minWidth: 120,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "hasAppAccess",
				accessorKey: "hasAppAccess",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Access" />
				),
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.hasAppAccess ? "default" : "secondary"
						}
						className="gap-1"
					>
						<UserCheckIcon className="h-3.5 w-3.5" />
						{row.original.hasAppAccess ? "Has Access" : "No Access"}
					</Badge>
				),
				meta: {
					label: "Access",
					width: 130,
					minWidth: 130,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "displayRoles",
				accessorKey: "displayRoles",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Org Roles" />
				),
				cell: ({ row }) =>
					row.original.memberRoles.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{row.original.memberRoles.map((role) => (
								<Badge
									key={role}
									variant="secondary"
									className="capitalize"
								>
									{role.replace(/_/g, " ")}
								</Badge>
							))}
						</div>
					) : (
						<span className="text-muted-foreground">-</span>
					),
				meta: {
					label: "Org Roles",
					width: 180,
					minWidth: 180,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "specializations",
				accessorKey: "specializations",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Specialisations"
					/>
				),
				cell: ({ row }) => {
					const specializations = row.original.specializations;
					if (!specializations.length) {
						return <span className="text-muted-foreground">-</span>;
					}
					return (
						<div className="flex flex-wrap gap-1">
							{specializations.map((item) => (
								<Badge key={item} variant="outline">
									{specializationLabelMap.get(item) ?? item}
								</Badge>
							))}
						</div>
					);
				},
				meta: {
					label: "Specialisations",
					width: 200,
					minWidth: 200,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "phoneNumber",
				accessorKey: "phoneNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Phone" />
				),
				cell: ({ row }) => row.original.phoneNumber || "-",
				meta: {
					label: "Phone",
					icon: PhoneIcon,
					width: 140,
					minWidth: 140,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "status",
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<Badge
						variant="secondary"
						className={
							statusColors[row.original.status] ??
							statusColors.active
						}
					>
						{row.original.status}
					</Badge>
				),
				meta: {
					label: "Status",
					variant: "multiSelect" as const,
					icon: UserIcon,
					options: statusOptions,
					width: 120,
					minWidth: 120,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "dailyRate",
				accessorKey: "dailyRate",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Daily Rate"
						className="justify-end"
					/>
				),
				cell: ({ row }) => (
					<div className="text-right font-semibold tabular-nums">
						{row.original.dailyRate
							? formatMoney(row.original.dailyRate)
							: "-"}
					</div>
				),
				meta: {
					label: "Daily Rate",
					width: 120,
					minWidth: 120,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "actions",
				header: ({ table }) => <DataTableViewOptions table={table} />,
				cell: ({ row }) => (
					<DataTableRowActions
						row={row.original}
						actions={rowActions}
					/>
				),
				enableSorting: false,
				enableHiding: false,
				meta: {
					width: 48,
					minWidth: 48,
					// First right-sticky column - add left border + fade
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10",
				},
			},
		],
		[rowActions, specializationLabelMap],
	);

	return (
		<>
			{/* Table with sort context */}
			<SortProvider
				sortColumn={sorting.sortBy}
				sortDirection={sorting.sortDirection}
			>
				<DataTable
					columns={columns}
					data={crews}
					isLoading={isLoading}
					isFetching={isFetching}
					pagination={serverPagination}
					onPaginationChange={onPaginationChange}
					onLimitChange={onLimitChange}
					sorting={sortingState}
					onSortingChange={onSortingChange}
					columnVisibility={columnVisibility}
					onColumnVisibilityChange={onColumnVisibilityChange}
					enableRowSelection
					getRowId={(row) => row.id}
					// Sticky columns configuration
					stickyLeftColumns={[
						{ id: "select", width: 48 },
						{ id: "name", width: 200 },
					]}
					stickyRightColumns={[{ id: "actions", width: 48 }]}
					minWidth={850}
					// Place scroll controls in the last sticky left column
					scrollControlsColumnId="name"
					scrollStartColumn={2}
					emptyState={
						<div className="flex flex-col items-center gap-2">
							<UserIcon className="h-12 w-12 text-muted-foreground/50" />
							<p className="text-muted-foreground">
								No people found
							</p>
							<OpenCrewCreateSheet
								variant="outline"
								size="sm"
								label="Add your first contractual person"
							/>
							{activeWorkerType === "internal" &&
								organizationId && (
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											setInviteDialogOpen(true)
										}
									>
										Invite your first member
									</Button>
								)}
						</div>
					}
				/>
			</SortProvider>

			{organizationId && (
				<InviteMemberDialog
					organizationId={organizationId}
					open={inviteDialogOpen}
					onOpenChange={setInviteDialogOpen}
					defaultEmail={crewToInvite?.email ?? ""}
					title="Invite to App"
					description="Give this person workspace access. Their People profile will stay linked."
					submitLabel="Send invite"
				/>
			)}

			{/* Delete confirmation dialog */}
			<AlertDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete person?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{crewToDelete?.name}".
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (crewToDelete) {
									deleteMutation.mutate({
										id: crewToDelete.id,
									});
								}
							}}
							disabled={deleteMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending && (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
