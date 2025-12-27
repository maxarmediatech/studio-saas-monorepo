"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { ChevronsUpDown, Plus, Shield } from "lucide-react";
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
					role="combobox"
					aria-label="Open quick create menu"
					className="w-[100px] justify-between"
				>
					<Plus className="mr-1 size-4 shrink-0" />
					<span>New</span>
					<ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="w-[200px]">
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
