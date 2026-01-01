"use client";

import { Button } from "@repo/ui/components/button";
import { PlusIcon, PencilIcon } from "lucide-react";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenConfigurationCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	configurationType: string;
	label?: string;
	showIcon?: boolean;
}

export function OpenConfigurationCreateSheet({
	configurationType,
	label = "Add",
	showIcon = true,
	children,
	...props
}: OpenConfigurationCreateSheetProps) {
	const { openCreate } = useConfigurationParams();

	return (
		<Button onClick={() => openCreate(configurationType)} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenConfigurationEditSheetProps extends Omit<ButtonProps, "onClick" | "children"> {
	configurationId: string;
	configurationType: string;
}

export function OpenConfigurationEditSheet({
	configurationId,
	configurationType,
	...props
}: OpenConfigurationEditSheetProps) {
	const { openEdit } = useConfigurationParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(configurationId, configurationType)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
