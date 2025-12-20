"use client";

import { config } from "@repo/config";
import { Button } from "@repo/ui/components/button";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { OrganizationWithStats } from "../lib/types";
import { AnnouncementsSection } from "./AnnouncementsSection";
import { AppsSection } from "./AppsSection";
import { OrganizationCard } from "./OrganizationCard";

type HubPageProps = {
	userName: string;
	organizations: OrganizationWithStats[];
};

export function HubPage({ userName, organizations }: HubPageProps) {
	const t = useTranslations();

	const hasOrganizations = organizations.length > 0;
	const firstName = userName.split(" ")[0];

	return (
		<div className="mx-auto max-w-6xl space-y-12 py-2">
			{/* Hero Section - Clean, minimal greeting */}
			<header className="space-y-1">
				<h1 className="font-semibold text-3xl tracking-tight">
					{t("hub.title")}, {firstName}
				</h1>
				<p className="text-muted-foreground text-lg">
					{t("hub.subtitle")}
				</p>
			</header>

			{/* Primary Action Area - Organizations */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
						{t("hub.organizations.title")}
					</h2>
					{hasOrganizations &&
						config.organizations.enableUsersToCreateOrganizations && (
							<Button variant="ghost" size="sm" asChild>
								<Link href="/new-organization">
									<PlusIcon className="size-4" />
									{t("hub.organizations.createNew")}
								</Link>
							</Button>
						)}
				</div>

				{hasOrganizations ? (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{organizations.map((organization) => (
							<OrganizationCard
								key={organization.id}
								organization={organization}
							/>
						))}
					</div>
					) : (
						/* Empty State - Prominent CTA */
						<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/30 px-6 py-16 text-center">
							<div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
								<PlusIcon className="size-8 text-primary" />
							</div>
							<h3 className="font-semibold text-lg">
								{t("hub.organizations.emptyTitle")}
							</h3>
							<p className="mt-1 max-w-sm text-muted-foreground text-sm">
								{t("hub.organizations.emptyDescription")}
							</p>
							{config.organizations.enableUsersToCreateOrganizations && (
								<Button className="mt-6" asChild>
									<Link href="/new-organization">
										<PlusIcon className="size-4" />
									{t("hub.organizations.createNew")}
									<ArrowRightIcon className="size-4" />
								</Link>
							</Button>
						)}
					</div>
				)}
			</section>

			{/* Secondary Content - Two Column Layout */}
			<div className="grid gap-8 lg:grid-cols-5">
				{/* Apps - Takes more space as primary content */}
				<section className="space-y-4 lg:col-span-3">
					<h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
						{t("hub.apps.title")}
					</h2>
					<AppsSection />
				</section>

				{/* Announcements - Sidebar style */}
				<aside className="space-y-4 lg:col-span-2">
					<div className="flex items-center justify-between">
						<h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
							{t("hub.announcements.title")}
						</h2>
					</div>
					<AnnouncementsSection />
				</aside>
			</div>
		</div>
	);
}
