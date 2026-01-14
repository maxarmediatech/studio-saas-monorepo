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

interface NewActionSwitcherProps {
	studioSlug: string;
	caps: HeaderCapabilities;
}

export function NewActionSwitcher({
	studioSlug,
	caps,
}: NewActionSwitcherProps) {
	const basePath = `/app/${studioSlug}`;

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
							<DropdownMenuItem asChild>
								<Link href={`${basePath}/shoots?create=true`}>
									New Shoot
								</Link>
							</DropdownMenuItem>
						)}

						{caps.deliverableCreateOrUpdate && (
							<DropdownMenuItem asChild>
								<Link
									href={`${basePath}/deliverables?create=true`}
								>
									New Deliverable
								</Link>
							</DropdownMenuItem>
						)}

						{caps.taskCreateOrUpdate && (
							<DropdownMenuItem asChild>
								<Link href={`${basePath}/tasks?create=true`}>
									New Task
								</Link>
							</DropdownMenuItem>
						)}

						{(caps.expenseCreateOrUpdate ||
							caps.paymentCreateOrUpdate) && (
							<DropdownMenuSeparator />
						)}

						{caps.paymentCreateOrUpdate && (
							<DropdownMenuItem asChild>
								<Link href={`${basePath}/payments?create=true`}>
									New Payment
								</Link>
							</DropdownMenuItem>
						)}

						{caps.expenseCreateOrUpdate && (
							<DropdownMenuItem asChild>
								<Link href={`${basePath}/expenses?create=true`}>
									New Expense
								</Link>
							</DropdownMenuItem>
						)}

						{(caps.crewCreateOrUpdate ||
							caps.clientCreateOrUpdate) && (
							<DropdownMenuSeparator />
						)}

						{caps.clientCreateOrUpdate && (
							<DropdownMenuItem asChild>
								<Link href={`${basePath}/clients?create=true`}>
									New Client
								</Link>
							</DropdownMenuItem>
						)}

						{caps.crewCreateOrUpdate && (
							<DropdownMenuItem asChild>
								<Link href={`${basePath}/crews?create=true`}>
									New Crew
								</Link>
							</DropdownMenuItem>
						)}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
