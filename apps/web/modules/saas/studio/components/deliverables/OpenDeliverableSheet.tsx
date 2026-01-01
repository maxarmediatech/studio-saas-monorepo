"use client";

import { Button } from "@repo/ui/components/button";
import { PlusIcon, PencilIcon } from "lucide-react";
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenDeliverableCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	label?: string;
	showIcon?: boolean;
}

export function OpenDeliverableCreateSheet({
	label = "Add Deliverable",
	showIcon = true,
	children,
	...props
}: OpenDeliverableCreateSheetProps) {
	const { openCreate } = useDeliverableParams();

	return (
		<Button onClick={openCreate} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenDeliverableEditSheetProps
	extends Omit<ButtonProps, "onClick" | "children"> {
	deliverableId: string;
}

export function OpenDeliverableEditSheet({
	deliverableId,
	...props
}: OpenDeliverableEditSheetProps) {
	const { openEdit } = useDeliverableParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(deliverableId)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
