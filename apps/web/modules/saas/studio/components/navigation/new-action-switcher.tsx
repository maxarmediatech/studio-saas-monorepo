"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { ChevronsUpDown, Plus, Shield, SquarePlus } from "lucide-react";
import Link from "next/link";
import { useClientParams } from "../../hooks/params/use-client-params";
import { useConfigurationParams } from "../../hooks/params/use-configuration-params";
import { useCrewParams } from "../../hooks/params/use-crew-params";
import { useDeliverableParams } from "../../hooks/params/use-deliverable-params";
import { useExpenseParams } from "../../hooks/params/use-expense-params";
import { usePaymentParams } from "../../hooks/params/use-payment-params";
import { useShootParams } from "../../hooks/params/use-shoot-params";
import { useTaskParams } from "../../hooks/params/use-task-params";
import type { HeaderCapabilities } from "../../lib/capability.server";

interface NewActionSwitcherProps {
	studioSlug: string;
	caps: HeaderCapabilities;
	variant?: "header" | "sidebar";
}

export function NewActionSwitcher({
	studioSlug,
	caps,
	variant = "header",
}: NewActionSwitcherProps) {
	const basePath = `/app/${studioSlug}`;
	const isSidebar = variant === "sidebar";

	// Sheet param hooks for opening create sheets without navigation
	const { openCreate: openShootCreate } = useShootParams();
	const { openCreate: openDeliverableCreate } = useDeliverableParams();
	const { openCreate: openTaskCreate } = useTaskParams();
	const { openCreate: openPaymentCreate } = usePaymentParams();
	const { openCreate: openExpenseCreate } = useExpenseParams();
	const { openCreate: openClientCreate } = useClientParams();
	const { openCreate: openCrewCreate } = useCrewParams();
	const { openCreate: openConfigurationCreate } = useConfigurationParams();

	const hasConfigurationActions =
		isSidebar && caps.configurationCreateOrUpdate;

	const hasAnyAction =
		caps.bookingCreateOrUpdate ||
		caps.shootCreateOrUpdate ||
		caps.deliverableCreateOrUpdate ||
		caps.taskCreateOrUpdate ||
		caps.expenseCreateOrUpdate ||
		caps.paymentCreateOrUpdate ||
		caps.crewCreateOrUpdate ||
		caps.clientCreateOrUpdate ||
		hasConfigurationActions;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					role={isSidebar ? undefined : "combobox"}
					aria-label="Open quick create menu"
					className={
						isSidebar
							? "h-8 w-full justify-start gap-2.5 rounded-lg py-2! pl-1.75! pr-2! text-sm font-normal text-neutral-700 hover:bg-black/5 active:bg-black/10"
							: "w-25 justify-between"
					}
				>
					{isSidebar ? (
						<SquarePlus className="size-4 shrink-0 text-neutral-600" />
					) : (
						<Plus className="mr-1 size-4 shrink-0" />
					)}
					<span>{isSidebar ? "New Item" : "New"}</span>
					{!isSidebar && (
						<ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
					)}
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				side={isSidebar ? "right" : "bottom"}
				align={isSidebar ? "start" : "end"}
				sideOffset={isSidebar ? 8 : 4}
				className="w-50"
			>
				{!hasAnyAction ? (
					<DropdownMenuItem
						disabled
						className="flex cursor-default flex-col items-start gap-1 py-3 focus:bg-transparent focus:text-foreground"
					>
						<div className="flex items-center gap-2">
							<Shield className="size-4 text-muted-foreground" />
							<span className="text-sm font-medium">
								No actions available
							</span>
						</div>
					</DropdownMenuItem>
				) : (
					<>
						{caps.bookingCreateOrUpdate && (
							<>
								<DropdownMenuItem asChild>
									<Link href={`${basePath}/bookings/new`}>
										New Booking
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
							</>
						)}

						{caps.shootCreateOrUpdate && (
							<DropdownMenuItem onSelect={openShootCreate}>
								New Shoot
							</DropdownMenuItem>
						)}

						{caps.deliverableCreateOrUpdate && (
							<DropdownMenuItem onSelect={openDeliverableCreate}>
								New Deliverable
							</DropdownMenuItem>
						)}

						{caps.taskCreateOrUpdate && (
							<DropdownMenuItem onSelect={openTaskCreate}>
								New Task
							</DropdownMenuItem>
						)}

						{(caps.expenseCreateOrUpdate ||
							caps.paymentCreateOrUpdate) && (
							<DropdownMenuSeparator />
						)}

						{caps.paymentCreateOrUpdate && (
							<DropdownMenuItem onSelect={openPaymentCreate}>
								New Payment
							</DropdownMenuItem>
						)}

						{caps.expenseCreateOrUpdate && (
							<DropdownMenuItem onSelect={openExpenseCreate}>
								New Expense
							</DropdownMenuItem>
						)}

						{(caps.crewCreateOrUpdate ||
							caps.clientCreateOrUpdate) && (
							<DropdownMenuSeparator />
						)}

						{caps.clientCreateOrUpdate && (
							<DropdownMenuItem onSelect={openClientCreate}>
								New Client
							</DropdownMenuItem>
						)}

						{caps.crewCreateOrUpdate && (
							<DropdownMenuItem onSelect={openCrewCreate}>
								New Crew
							</DropdownMenuItem>
						)}

						{hasConfigurationActions && (
							<>
								<DropdownMenuSeparator />

								<DropdownMenuItem
									onSelect={() =>
										openConfigurationCreate("booking_type")
									}
								>
									New Booking Type
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() =>
										openConfigurationCreate("package_type")
									}
								>
									New Package Type
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() =>
										openConfigurationCreate("event_type")
									}
								>
									New Event Type
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() =>
										openConfigurationCreate("relation_type")
									}
								>
									New Relation Type
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() =>
										openConfigurationCreate("crew_role")
									}
								>
									New Specialisation
								</DropdownMenuItem>
							</>
						)}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
