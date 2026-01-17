"use client";

import { PageContent } from "@saas/studio";
import { OpenPaymentCreateSheet } from "@saas/studio/components/payments/OpenPaymentSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function PaymentsLayout({ children }: Props) {
	return (
		<PageContent
			title="Payments"
			controls={<OpenPaymentCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
