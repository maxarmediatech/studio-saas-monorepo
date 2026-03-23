"use client";

import type { ActiveOrganization } from "@repo/auth";
import { authClient } from "@repo/auth/client";
import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { coerceOrganizationRoles } from "@repo/auth/lib/permissions";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { useSession } from "@saas/auth/hooks/use-session";
import { useAllRoles } from "@saas/organizations/hooks/use-all-roles";
import {
	fullOrganizationQueryKey,
	useFullOrganizationQuery,
} from "@saas/organizations/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
	ClockIcon,
	MailIcon,
	MailXIcon,
	MoreVerticalIcon,
	SendIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";
import { toast } from "sonner";

type Invitation = NonNullable<ActiveOrganization["invitations"]>[number];

function getExpiryMeta(expiresAt: string) {
	const expiresAtDate = new Date(expiresAt);
	const hasExpired = expiresAtDate.getTime() <= Date.now();

	return {
		hasExpired,
		relativeLabel: hasExpired
			? `Expired ${formatDistanceToNowStrict(expiresAtDate, {
					addSuffix: true,
				})}`
			: `Expires ${formatDistanceToNowStrict(expiresAtDate, {
					addSuffix: true,
				})}`,
	};
}

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

	const nextExpiry = formatter.dateTime(new Date(invitations[0].expiresAt), {
		dateStyle: "medium",
		timeStyle: "short",
	});

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm font-medium text-foreground">
					{invitations.length} pending
					{invitations.length === 1 ? " invitation" : " invitations"}
				</p>
				<p className="text-sm text-muted-foreground">
					Next expiry {nextExpiry}
				</p>
			</div>

			<ul className="overflow-hidden rounded-lg border bg-background">
				{invitations.map((invitation: Invitation) => {
					const roleKeys = coerceOrganizationRoles(invitation.role);
					const teamName = invitation.teamId
						? (teamNameById.get(invitation.teamId) ??
							"Unknown team")
						: null;
					const shouldShowBadges =
						roleKeys.length > 0 || Boolean(teamName);
					const expiryMeta = getExpiryMeta(invitation.expiresAt);
					const statusLabel = t(
						`organizations.settings.members.invitations.invitationStatus.${invitation.status}`,
					);

					return (
						<li
							key={invitation.id}
							className="border-b last:border-b-0"
						>
							<div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
								<div className="min-w-0 flex-1">
									<div className="flex items-start gap-3">
										<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
											<MailIcon
												className="size-4"
												aria-hidden="true"
											/>
										</div>

										<div className="min-w-0 flex-1 space-y-3">
											<div className="flex flex-wrap items-center gap-2">
												<Badge
													variant="outline"
													className="text-[11px]"
												>
													<ClockIcon
														className="size-3"
														aria-hidden="true"
													/>
													{statusLabel}
												</Badge>
												<Badge
													variant="outline"
													className={cn(
														"text-[11px] text-muted-foreground",
														expiryMeta.hasExpired &&
															"text-destructive",
													)}
												>
													{expiryMeta.relativeLabel}
												</Badge>
											</div>

											<div className="space-y-1">
												<p className="break-words font-medium text-base text-foreground">
													{invitation.email}
												</p>
												<p className="text-sm text-muted-foreground">
													{t(
														"organizations.settings.members.invitations.expiresAt",
														{
															date: formatter.dateTime(
																new Date(
																	invitation.expiresAt,
																),
																{
																	dateStyle:
																		"medium",
																	timeStyle:
																		"short",
																},
															),
														},
													)}
												</p>
											</div>

											{shouldShowBadges && (
												<div className="flex flex-wrap gap-2">
													{roleKeys.map((roleKey) => (
														<Badge
															key={roleKey}
															variant="outline"
															className="text-xs"
														>
															{getRoleLabel(
																roleKey,
															)}
														</Badge>
													))}
													{teamName && (
														<Badge
															variant="outline"
															className="text-xs"
														>
															Team: {teamName}
														</Badge>
													)}
												</div>
											)}
										</div>
									</div>
								</div>

								{canUserEditInvitations && (
									<div className="flex items-center justify-end lg:pl-4">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													size="icon"
													variant="ghost"
													aria-label={`Open actions for ${invitation.email}`}
												>
													<MoreVerticalIcon
														className="size-4"
														aria-hidden="true"
													/>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() =>
														revokeInvitation(
															invitation.id,
														)
													}
												>
													<MailXIcon
														className="mr-2 size-4"
														aria-hidden="true"
													/>
													{t(
														"organizations.settings.members.invitations.revoke",
													)}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
