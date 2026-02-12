"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";

type RowActionClick<TData> = {
	onClick: (row: TData) => void;
	href?: never;
	target?: never;
	rel?: never;
};

type RowActionHref<TData> = {
	href: (row: TData) => string;
	target?: "_self" | "_blank";
	rel?: string;
	onClick?: never;
};

export type RowAction<TData> = {
	label: string;
	icon?: React.ReactNode;
	variant?: "default" | "destructive";
	/** If true, adds a separator before this action */
	separator?: boolean;
	/** Conditionally show this action */
	show?: (row: TData) => boolean;
} & (RowActionClick<TData> | RowActionHref<TData>);

interface DataTableRowActionsProps<TData> {
	row: TData;
	actions: RowAction<TData>[];
}

export function DataTableRowActions<TData>({
	row,
	actions,
}: DataTableRowActionsProps<TData>) {
	const visibleActions = actions.filter(
		(action) => !action.show || action.show(row),
	);

	if (visibleActions.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center justify-center">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="h-8 w-8">
						<MoreHorizontalIcon className="h-4 w-4" />
						<span className="sr-only">Open menu</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{visibleActions.map((action, index) => (
						<div key={action.label}>
							{action.separator && index > 0 && (
								<DropdownMenuSeparator />
							)}
							{"onClick" in action && action.onClick ? (
								<DropdownMenuItem
									onClick={() => action.onClick(row)}
									className={
										action.variant === "destructive"
											? "text-destructive focus:text-destructive"
											: undefined
									}
								>
									{action.icon && (
										<span className="mr-2">
											{action.icon}
										</span>
									)}
									{action.label}
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem
									asChild
									className={
										action.variant === "destructive"
											? "text-destructive focus:text-destructive"
											: undefined
									}
								>
									<Link
										href={action.href(row)}
										target={action.target}
										rel={action.rel}
									>
										{action.icon && (
											<span className="mr-2">
												{action.icon}
											</span>
										)}
										{action.label}
									</Link>
								</DropdownMenuItem>
							)}
						</div>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
