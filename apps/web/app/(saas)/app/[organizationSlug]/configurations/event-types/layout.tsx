"use client";

import { PageContent } from "@saas/studio";
import { OpenConfigurationCreateSheet } from "@saas/studio/components/configurations/OpenConfigurationSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function EventTypesLayout({ children }: Props) {
	return (
		<PageContent
			title="Event Types"
			controls={
				<OpenConfigurationCreateSheet
					configurationType="event_type"
					size="sm"
				/>
			}
		>
			{children}
		</PageContent>
	);
}
