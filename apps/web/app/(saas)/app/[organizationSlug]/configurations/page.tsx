import { getActiveOrganization } from "@saas/auth/lib/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	return {
		title: `Configurations | ${activeOrganization?.name ?? "Studio"}`,
	};
}

export default async function ConfigurationsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	if (!activeOrganization) {
		return notFound();
	}

	const configItems = [
		{
			title: "Booking Types",
			description:
				"Manage the types of bookings available in your studio",
			href: `/app/${organizationSlug}/configurations/booking-types`,
		},
		{
			title: "Package Types",
			description: "Configure packages and pricing options",
			href: `/app/${organizationSlug}/configurations/package-types`,
		},
		{
			title: "Relation Types",
			description: "Define client and contact relationship types",
			href: `/app/${organizationSlug}/configurations/relation-types`,
		},
		{
			title: "Crew Roles",
			description: "Set up crew member roles and responsibilities",
			href: `/app/${organizationSlug}/configurations/crew-roles`,
		},
	];

	return (
		<div className="space-y-8">
			<header>
				<h1 className="text-2xl font-bold tracking-tight">
					Configurations
				</h1>
				<p className="text-muted-foreground">
					Customize your studio settings and options.
				</p>
			</header>

			<div className="grid gap-4 md:grid-cols-2">
				{configItems.map((item) => (
					<Link
						key={item.href}
						href={item.href}
						className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
					>
						<h2 className="font-semibold">{item.title}</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{item.description}
						</p>
					</Link>
				))}
			</div>
		</div>
	);
}
