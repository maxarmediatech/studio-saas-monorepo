"use client";

import { Button } from "@repo/ui/components/button";
import { useScheduleParams } from "@saas/studio/hooks/params/use-schedule-params";
import { PencilIcon, PlusIcon } from "lucide-react";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenScheduleCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	label?: string;
	showIcon?: boolean;
}

export function OpenScheduleCreateSheet({
	label = "Add Schedule",
	showIcon = true,
	children,
	...props
}: OpenScheduleCreateSheetProps) {
	const { openCreate } = useScheduleParams();

	return (
		<Button onClick={openCreate} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenScheduleEditSheetProps
	extends Omit<ButtonProps, "onClick" | "children"> {
	scheduleId: string;
}

export function OpenScheduleEditSheet({
	scheduleId,
	...props
}: OpenScheduleEditSheetProps) {
	const { openEdit } = useScheduleParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(scheduleId)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
