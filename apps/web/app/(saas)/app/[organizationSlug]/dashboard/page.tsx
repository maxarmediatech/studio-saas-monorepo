import { getActiveOrganization } from "@saas/auth/lib/server";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	return {
		title: `Dashboard | ${activeOrganization?.name ?? "Studio"}`,
	};
}

export default async function DashboardPage({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	if (!activeOrganization) {
		return notFound();
	}

	return (
		<div className="space-y-8">
			<header>
				<h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground">
					Overview of your studio metrics and performance.
				</p>
			</header>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Total Bookings
					</div>
					<p className="mt-2 text-2xl font-bold">—</p>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Active Shoots
					</div>
					<p className="mt-2 text-2xl font-bold">—</p>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Pending Tasks
					</div>
					<p className="mt-2 text-2xl font-bold">—</p>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Revenue
					</div>
					<p className="mt-2 text-2xl font-bold">—</p>
				</section>
			</div>
		</div>
	);
}
