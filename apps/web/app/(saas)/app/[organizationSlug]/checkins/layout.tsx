"use client";

import { Button } from "@repo/ui/components/button";
import { PageContent } from "@saas/studio";
import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CheckinsProvider, useCheckinsContext } from "./checkins-context";

type Props = {
	children: ReactNode;
};

function CheckinsLayoutInner({ children }: Props) {
	const { openCreateDialog } = useCheckinsContext();

	return (
		<PageContent
			title="Checkins"
			controls={
				<Button size="sm" onClick={openCreateDialog}>
					<PlusIcon className="mr-2 h-4 w-4" />
					New Checkin
				</Button>
			}
		>
			{children}
		</PageContent>
	);
}

export default function CheckinsLayout({ children }: Props) {
	return (
		<CheckinsProvider>
			<CheckinsLayoutInner>{children}</CheckinsLayoutInner>
		</CheckinsProvider>
	);
}
