"use client";

import { PageContent } from "@saas/studio";
import { OpenConfigurationCreateSheet } from "@saas/studio/components/configurations/OpenConfigurationSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function BookingTypesLayout({ children }: Props) {
	return (
		<PageContent
			title="Booking Types"
			controls={
				<OpenConfigurationCreateSheet
					configurationType="booking_type"
					size="sm"
				/>
			}
		>
			{children}
		</PageContent>
	);
}
