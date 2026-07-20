import { getSession } from "@saas/auth/lib/server";
import { ShootsCalendarWorkspace } from "@saas/studio/components/calendar/shoots-calendar-workspace";

export const metadata = { title: "Calendar" };

export default async function CalendarWorkspacePage() {
	const session = await getSession();

	return (
		<ShootsCalendarWorkspace timeZone={session?.user?.timezone ?? "UTC"} />
	);
}
