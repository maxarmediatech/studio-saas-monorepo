"use client";

import { Button } from "@repo/ui/components/button";
import { PlusIcon, PencilIcon } from "lucide-react";
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenClientCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	label?: string;
	showIcon?: boolean;
}

export function OpenClientCreateSheet({
	label = "Add Client",
	showIcon = true,
	children,
	...props
}: OpenClientCreateSheetProps) {
	const { openCreate } = useClientParams();

	return (
		<Button onClick={openCreate} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenClientEditSheetProps
	extends Omit<ButtonProps, "onClick" | "children"> {
	clientId: string;
}

export function OpenClientEditSheet({
	clientId,
	...props
}: OpenClientEditSheetProps) {
	const { openEdit } = useClientParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(clientId)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
