import { getSession } from "@saas/auth/lib/server";
import { redirect } from "next/navigation";

export async function generateMetadata() {
	return {
		title: "Notification Settings",
	};
}

export default async function NotificationsSettingsPage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return (
		<div className="px-4 pt-6 pb-8 lg:px-6">
			<div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
				<h3 className="text-lg font-medium text-neutral-900">
					Notification Settings
				</h3>
				<p className="mt-2 text-sm text-neutral-500">
					Configure email notifications, push alerts, and in-app
					notifications.
				</p>
				<p className="mt-4 text-sm text-neutral-400">Coming soon</p>
			</div>
		</div>
	);
}
