import { Skeleton } from "@repo/ui/components/skeleton";
import { getSession } from "@saas/auth/lib/server";
import { ShootsCalendarWorkspace } from "@saas/studio/components/calendar/shoots-calendar-workspace";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarWorkspacePage() {
	return (
		<Suspense fallback={<Skeleton className="h-full min-h-96 w-full" />}>
			<CalendarWorkspaceContent />
		</Suspense>
	);
}

async function CalendarWorkspaceContent() {
	const session = await getSession();

	return (
		<ShootsCalendarWorkspace timeZone={session?.user?.timezone ?? "UTC"} />
	);
}
