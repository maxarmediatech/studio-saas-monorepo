"use client";

import { Button } from "@repo/ui/components/button";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { PencilIcon, PlusIcon } from "lucide-react";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenCrewCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	label?: string;
	showIcon?: boolean;
}

export function OpenCrewCreateSheet({
	label = "Add Contractual Person",
	showIcon = true,
	children,
	...props
}: OpenCrewCreateSheetProps) {
	const { openCreate } = useCrewParams();

	return (
		<Button onClick={openCreate} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenCrewEditSheetProps
	extends Omit<ButtonProps, "onClick" | "children"> {
	crewId: string;
}

export function OpenCrewEditSheet({
	crewId,
	...props
}: OpenCrewEditSheetProps) {
	const { openEdit } = useCrewParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(crewId)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
