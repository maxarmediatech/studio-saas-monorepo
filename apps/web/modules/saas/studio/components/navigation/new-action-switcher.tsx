"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Shield, SquarePlus } from "lucide-react";
import Link from "next/link";
import type { HeaderCapabilities } from "../../lib/capability.server";
import { useClientParams } from "../../hooks/params/use-client-params";
import { useCrewParams } from "../../hooks/params/use-crew-params";
import { useDeliverableParams } from "../../hooks/params/use-deliverable-params";
import { useExpenseParams } from "../../hooks/params/use-expense-params";
import { usePaymentParams } from "../../hooks/params/use-payment-params";
import { useShootParams } from "../../hooks/params/use-shoot-params";
import { useTaskParams } from "../../hooks/params/use-task-params";

interface NewActionSwitcherProps {
	studioSlug: string;
	caps: HeaderCapabilities;
}

export function NewActionSwitcher({
	studioSlug,
	caps,
}: NewActionSwitcherProps) {
	const basePath = `/app/${studioSlug}`;

	// Sheet param hooks for opening create sheets without navigation
	const { openCreate: openShootCreate } = useShootParams();
	const { openCreate: openDeliverableCreate } = useDeliverableParams();
	const { openCreate: openTaskCreate } = useTaskParams();
	const { openCreate: openPaymentCreate } = usePaymentParams();
	const { openCreate: openExpenseCreate } = useExpenseParams();
	const { openCreate: openClientCreate } = useClientParams();
	const { openCreate: openCrewCreate } = useCrewParams();

	const hasAnyAction =
		caps.bookingCreateOrUpdate ||
		caps.shootCreateOrUpdate ||
		caps.deliverableCreateOrUpdate ||
		caps.taskCreateOrUpdate ||
		caps.expenseCreateOrUpdate ||
		caps.paymentCreateOrUpdate ||
		caps.crewCreateOrUpdate ||
		caps.clientCreateOrUpdate;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					aria-label="Open quick create menu"
					className="h-8 w-full justify-start gap-2.5 rounded-lg py-2! pl-[7px]! pr-2! text-sm font-normal text-neutral-700 hover:bg-black/5 active:bg-black/10"
				>
					<SquarePlus className="size-4 shrink-0 text-neutral-600" />
					<span>Add New Item </span>
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				side="right"
				align="start"
				sideOffset={8}
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
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
