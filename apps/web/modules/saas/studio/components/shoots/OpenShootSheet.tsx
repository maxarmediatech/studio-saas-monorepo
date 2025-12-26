"use client";

import { Button } from "@repo/ui/components/button";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { PencilIcon, PlusIcon } from "lucide-react";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenShootCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	label?: string;
	showIcon?: boolean;
}

export function OpenShootCreateSheet({
	label = "Add Shoot",
	showIcon = true,
	children,
	...props
}: OpenShootCreateSheetProps) {
	const { openCreate } = useShootParams();

	return (
		<Button onClick={openCreate} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenShootEditSheetProps
	extends Omit<ButtonProps, "onClick" | "children"> {
	shootId: string;
}

export function OpenShootEditSheet({
	shootId,
	...props
}: OpenShootEditSheetProps) {
	const { openEdit } = useShootParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(shootId)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
