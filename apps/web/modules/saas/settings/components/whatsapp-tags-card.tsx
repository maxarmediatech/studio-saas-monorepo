"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { whatsappApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CircleAlertIcon, SearchIcon, TagIcon } from "lucide-react";
import { useMemo, useState } from "react";

export function WhatsAppTagsCard() {
	const [search, setSearch] = useState("");
	const normalizedSearch = search.trim();
	const tagsQuery = useQuery({
		...whatsappApi.listContactTagsOptions(
			normalizedSearch ? { search: normalizedSearch } : {},
		),
		refetchOnWindowFocus: false,
	});
	const tags = tagsQuery.data?.data ?? [];
	const totalTaggedContacts = useMemo(
		() => tags.reduce((sum, tag) => sum + tag.contactCount, 0),
		[tags],
	);

	return (
		<SettingsItem
			title={
				<span className="inline-flex items-center gap-2">
					<TagIcon className="size-4 text-primary/60" />
					WhatsApp Tags
				</span>
			}
			description="Review labels currently used for WhatsApp contact segments."
		>
			<div className="space-y-4 rounded-xl border border-border bg-card p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="m-0 text-sm font-medium text-foreground">
							Contact labels
						</p>
						<p className="m-0 text-xs text-muted-foreground">
							{totalTaggedContacts} tagged contact assignments
						</p>
					</div>
					<div className="relative sm:w-72">
						<SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search tags"
							className="pl-9"
						/>
					</div>
				</div>

				{tagsQuery.isLoading ? (
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton
								key={`whatsapp-tag-skeleton-${index + 1}`}
								className="h-14 rounded-xl"
							/>
						))}
					</div>
				) : tagsQuery.isError ? (
					<Alert
						variant="destructive"
						className="border-destructive/20"
					>
						<CircleAlertIcon />
						<AlertTitle>Unable to load tags</AlertTitle>
						<AlertDescription>
							<p>
								{tagsQuery.error.message ||
									"Try again shortly."}
							</p>
						</AlertDescription>
					</Alert>
				) : tags.length === 0 ? (
					<Alert className="border-border/70 bg-background">
						<CircleAlertIcon />
						<AlertTitle>No WhatsApp tags yet</AlertTitle>
						<AlertDescription>
							Tags will appear here once contacts are labeled.
						</AlertDescription>
					</Alert>
				) : (
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{tags.map((tag) => (
							<div
								key={tag.name}
								className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-3"
							>
								<div className="min-w-0">
									<p className="m-0 truncate text-sm font-medium text-foreground">
										{tag.name}
									</p>
									<p className="m-0 text-xs text-muted-foreground">
										Segment label
									</p>
								</div>
								<Badge variant="outline" className="shrink-0">
									{tag.contactCount}
								</Badge>
							</div>
						))}
					</div>
				)}
			</div>
		</SettingsItem>
	);
}
