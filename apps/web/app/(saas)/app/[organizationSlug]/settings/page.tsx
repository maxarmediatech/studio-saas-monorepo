import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/studio";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
	CalendarDaysIcon,
	PackageIcon,
	UsersIcon,
	TagIcon,
	SettingsIcon,
} from "lucide-react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Settings | ${organization?.name ?? "Studio"}`,
	};
}

const configurationLinks = [
	{
		title: "Booking Types",
		description: "Configure types of bookings (Wedding, Pre-Wedding, etc.)",
		href: "booking-types",
		icon: CalendarDaysIcon,
	},
	{
		title: "Package Types",
		description: "Configure service packages (Basic, Premium, etc.)",
		href: "package-types",
		icon: PackageIcon,
	},
	{
		title: "Relation Types",
		description: "Configure client relations (Bride, Groom, Family, etc.)",
		href: "relation-types",
		icon: UsersIcon,
	},
	{
		title: "Crew Roles",
		description: "Configure crew member roles (Photographer, Videographer, etc.)",
		href: "crew-roles",
		icon: TagIcon,
	},
];

export default async function SettingsPage({ params }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<>
			<PageHeader title="Settings" />
			<div className="space-y-6">
				<div>
					<h2 className="text-lg font-medium mb-4">Configurations</h2>
					<div className="grid gap-4 md:grid-cols-2">
						{configurationLinks.map((link) => (
							<Link
								key={link.href}
								href={`/app/${organizationSlug}/settings/${link.href}`}
								className="flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
							>
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<link.icon className="h-5 w-5 text-primary" />
								</div>
								<div>
									<h3 className="font-medium">{link.title}</h3>
									<p className="text-sm text-muted-foreground">
										{link.description}
									</p>
								</div>
							</Link>
						))}
					</div>
				</div>

				<div>
					<h2 className="text-lg font-medium mb-4">Organization</h2>
					<div className="grid gap-4 md:grid-cols-2">
						<Link
							href={`/app/${organizationSlug}/settings/general`}
							className="flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<SettingsIcon className="h-5 w-5 text-primary" />
							</div>
							<div>
								<h3 className="font-medium">General Settings</h3>
								<p className="text-sm text-muted-foreground">
									Update organization name, logo, and other details
								</p>
							</div>
						</Link>
					</div>
				</div>
			</div>
		</>
	);
}
