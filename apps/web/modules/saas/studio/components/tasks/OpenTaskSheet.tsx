"use client";

import { Button } from "@repo/ui/components/button";
import { PlusIcon, PencilIcon } from "lucide-react";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenTaskCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	label?: string;
	showIcon?: boolean;
}

export function OpenTaskCreateSheet({
	label = "Add Task",
	showIcon = true,
	children,
	...props
}: OpenTaskCreateSheetProps) {
	const { openCreate } = useTaskParams();

	return (
		<Button onClick={openCreate} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenTaskEditSheetProps
	extends Omit<ButtonProps, "onClick" | "children"> {
	taskId: string;
}

export function OpenTaskEditSheet({
	taskId,
	...props
}: OpenTaskEditSheetProps) {
	const { openEdit } = useTaskParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(taskId)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
