import { getSession } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata() {
	return {
		title: "Security Settings",
	};
}

export default async function SecuritySettingsPage({ params }: Props) {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return (
		<PageContent title="Security">
			<div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
				<h3 className="text-lg font-medium text-neutral-900">
					Security Settings
				</h3>
				<p className="mt-2 text-sm text-neutral-500">
					Manage your password, two-factor authentication, and active sessions.
				</p>
				<p className="mt-4 text-sm text-neutral-400">Coming soon</p>
			</div>
		</PageContent>
	);
}
