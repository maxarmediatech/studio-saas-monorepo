import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	return {
		title: `Home | ${activeOrganization?.name ?? "Studio"}`,
	};
}

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) {
		return "Good morning";
	}
	if (hour < 17) {
		return "Good afternoon";
	}
	return "Good evening";
}

export default async function HomePage({ params }: Props) {
	const { organizationSlug } = await params;

	const session = await getSession();
	const activeOrganization = await getActiveOrganization(organizationSlug);

	if (!activeOrganization) {
		return notFound();
	}

	const firstName = session?.user?.name?.split(" ")[0] ?? "there";

	return (
		<div className="space-y-8">
			<header>
				<h1 className="text-2xl font-bold tracking-tight">
					{getGreeting()}, {firstName}!
				</h1>
				<p className="text-muted-foreground">
					Here&apos;s what&apos;s happening in your studio today.
				</p>
			</header>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Organization
					</div>
					<p className="mt-2 text-xl font-semibold">
						{activeOrganization.name}
					</p>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Quick Actions
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Coming soon...
					</p>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Recent Activity
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Coming soon...
					</p>
				</section>
			</div>
		</div>
	);
}
