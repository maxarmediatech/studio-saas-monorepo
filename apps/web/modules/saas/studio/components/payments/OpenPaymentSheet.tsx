"use client";

import { Button } from "@repo/ui/components/button";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import { PencilIcon, PlusIcon } from "lucide-react";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface OpenPaymentCreateSheetProps extends Omit<ButtonProps, "onClick"> {
	label?: string;
	showIcon?: boolean;
}

export function OpenPaymentCreateSheet({
	label = "Record Payment",
	showIcon = true,
	children,
	...props
}: OpenPaymentCreateSheetProps) {
	const { openCreate } = usePaymentParams();

	return (
		<Button onClick={openCreate} {...props}>
			{showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
			{children ?? label}
		</Button>
	);
}

interface OpenPaymentEditSheetProps
	extends Omit<ButtonProps, "onClick" | "children"> {
	paymentId: string;
}

export function OpenPaymentEditSheet({
	paymentId,
	...props
}: OpenPaymentEditSheetProps) {
	const { openEdit } = usePaymentParams();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => openEdit(paymentId)}
			{...props}
		>
			<PencilIcon className="h-4 w-4" />
		</Button>
	);
}
