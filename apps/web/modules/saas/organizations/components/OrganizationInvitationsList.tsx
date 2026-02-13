"use client";

import type { ActiveOrganization } from "@repo/auth";
import { authClient } from "@repo/auth/client";
import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { normalizeRoles } from "@repo/auth/lib/permissions";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import { useSession } from "@saas/auth/hooks/use-session";
import {
	fullOrganizationQueryKey,
	useFullOrganizationQuery,
} from "@saas/organizations/lib/api";
import { useAllRoles } from "@saas/organizations/hooks/use-all-roles";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	CheckIcon,
	ClockIcon,
	MailXIcon,
	MoreVerticalIcon,
	SendIcon,
	XIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";
import { toast } from "sonner";

export function OrganizationInvitationsList({
	organizationId,
	onInvite,
}: {
	organizationId: string;
	onInvite?: () => void;
}) {
	const t = useTranslations();
	const queryClient = useQueryClient();
	const { user } = useSession();
	const formatter = useFormatter();
	const { data: organization } = useFullOrganizationQuery(organizationId);

	const canUserEditInvitations = isOrganizationAdmin(organization, user);
	const { getRoleLabel } = useAllRoles({
		enabled: canUserEditInvitations,
	});

	const invitations = useMemo(
		() =>
			organization?.invitations
				?.filter((invitation) => invitation.status === "pending")
				.sort(
					(a, b) =>
						new Date(a.expiresAt).getTime() -
						new Date(b.expiresAt).getTime(),
				),
		[organization?.invitations],
	);
	const teamNameById = useMemo(() => {
		const teams = organization?.teams ?? [];
		return new Map(teams.map((team) => [team.id, team.name]));
	}, [organization?.teams]);

	const revokeInvitation = (invitationId: string) => {
		toast.promise(
			async () => {
				const { error } =
					await authClient.organization.cancelInvitation({
						invitationId,
					});

				if (error) {
					throw error;
				}
			},
			{
				loading: t(
					"organizations.settings.members.notifications.revokeInvitation.loading.description",
				),
				success: () => {
					queryClient.invalidateQueries({
						queryKey: fullOrganizationQueryKey(organizationId),
					});
					return t(
						"organizations.settings.members.notifications.revokeInvitation.success.description",
					);
				},
				error: t(
					"organizations.settings.members.notifications.revokeInvitation.error.description",
				),
			},
		);
	};

	const columns: ColumnDef<
		NonNullable<ActiveOrganization["invitations"]>[number]
	>[] = [
		{
			accessorKey: "email",
			accessorFn: (row) => row.email,
			cell: ({ row }) => {
				const InvitationStatusIcon = {
					pending: ClockIcon,
					accepted: CheckIcon,
					rejected: XIcon,
					canceled: XIcon,
				}[row.original.status];
				const roleKeys = normalizeRoles(row.original.role);
				const teamName = row.original.teamId
					? teamNameById.get(row.original.teamId) ?? "Unknown team"
					: null;
				const shouldShowBadges =
					roleKeys.length > 0 || Boolean(teamName);
				return (
					<div className="leading-normal">
						<strong
							className={cn("block", {
								"opacity-50":
									row.original.status === "canceled",
							})}
						>
							{row.original.email}
						</strong>
						<small className="flex flex-wrap gap-1 text-foreground/60">
							<span className="flex items-center gap-0.5">
								<InvitationStatusIcon className="size-3" />
								{t(
									`organizations.settings.members.invitations.invitationStatus.${row.original.status}`,
								)}
							</span>
							<span>-</span>
							<span>
								{t(
									"organizations.settings.members.invitations.expiresAt",
									{
										date: formatter.dateTime(
											new Date(row.original.expiresAt),
											{
												dateStyle: "medium",
												timeStyle: "short",
											},
										),
									},
								)}
							</span>
						</small>
						{shouldShowBadges && (
							<div className="mt-1 flex flex-wrap gap-1">
								{roleKeys.map((roleKey) => (
									<Badge
										key={roleKey}
										variant="outline"
										className="text-xs"
									>
										{getRoleLabel(roleKey)}
									</Badge>
								))}
								{teamName && (
									<Badge variant="outline" className="text-xs">
										Team: {teamName}
									</Badge>
								)}
							</div>
						)}
					</div>
				);
			},
		},
		{
			accessorKey: "actions",
			cell: ({ row }) => {
				const isPending = row.original.status === "pending";

				return (
					<div className="flex flex-row justify-end gap-2">
						{canUserEditInvitations && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button size="icon" variant="ghost">
										<MoreVerticalIcon className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuItem
										disabled={!isPending}
										onClick={() =>
											revokeInvitation(row.original.id)
										}
									>
										<MailXIcon className="mr-2 size-4" />
										{t(
											"organizations.settings.members.invitations.revoke",
										)}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				);
			},
		},
	];

	const table = useReactTable({
		data: invitations ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	if (!invitations?.length) {
		return (
			<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/30 px-6 py-16 text-center">
				<div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
					<SendIcon className="size-8 text-primary" />
				</div>
				<h3 className="font-semibold text-lg">
					No pending invitations
				</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Invite team members to collaborate on bookings, tasks, and
					more.
				</p>
				{onInvite && (
					<Button className="mt-6" onClick={onInvite}>
						<SendIcon className="size-4" />
						Invite Member
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="rounded-md border">
			<Table>
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow
							key={row.id}
							data-state={row.getIsSelected() && "selected"}
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id}>
									{flexRender(
										cell.column.columnDef.cell,
										cell.getContext(),
									)}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
