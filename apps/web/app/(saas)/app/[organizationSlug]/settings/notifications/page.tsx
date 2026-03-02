import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"notifications",
	);

	return {
		title: `Notification Settings | ${context?.organization.name ?? "Studio"}`,
	};
}

export default async function NotificationsSettingsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"notifications",
	);

	if (!context) {
		return notFound();
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
