"use client";

import { PageContent } from "@saas/studio";
import { OpenPaymentCreateSheet } from "@saas/studio/components/payments/OpenPaymentSheet";
import { type ReactNode, use } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function PaymentsLayout({ params, children }: Props) {
	// Unwrap params promise (required by Next.js, slug available via context)
	use(params);

	return (
		<PageContent
			title="Payments"
			controls={<OpenPaymentCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
