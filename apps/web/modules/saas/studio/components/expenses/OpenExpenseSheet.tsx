"use client";

import { Button } from "@repo/ui/components/button";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
import { PencilIcon, PlusIcon } from "lucide-react";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenExpenseCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	label?: string;
	showIcon?: boolean;
}

export function OpenExpenseCreateSheet({
	label = "Add Expense",
	showIcon = true,
	children,
	...props
}: OpenExpenseCreateSheetProps) {
	const { openCreate } = useExpenseParams();

	return (
		<Button onClick={openCreate} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenExpenseEditSheetProps
	extends Omit<ButtonProps, "onClick" | "children"> {
	expenseId: string;
}

export function OpenExpenseEditSheet({
	expenseId,
	...props
}: OpenExpenseEditSheetProps) {
	const { openEdit } = useExpenseParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(expenseId)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
